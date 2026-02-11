import { Color } from "./color";
import { createOrthoMatrix, type Matrix4x4 } from "./mat4";
import type { Renderer } from "./renderer";
import { RenderCommand } from "./RenderPass";
import { FRAG_SRC, VERT_SRC } from "./Shape_Shader";

export interface ShapeCommand extends RenderCommand {
    type: "shape";

    x: number;
    y: number;
    width: number;
    height: number;

    rotation: number;
    originX: number;
    originY: number;

    color: [number, number, number, number];
}

/**
 * Renders simple shapes using Shapeing and on a single draw call with instanced drawing 
 */
export class ShapeRenderer {
  private renderer: Renderer;


    maxInstances: number;
    instanceStride: number;
    instanceData: Float32Array;
    instanceCount: number = 0;

    //uResolution: WebGLUniformLocation | null;
    uProjectionMatrix: WebGLUniformLocation | null;

    projectionMatrix: Matrix4x4

    program: WebGLProgram;
    vao: WebGLVertexArrayObject;
    quadVBO: WebGLBuffer;
    instanceVBO: WebGLBuffer;


  // Instance packing details
  // Attribute layout (floats):
  // a_translation.x, a_translation.y,         // 2
  // a_size.x, a_size.y,                       // 2
  // a_rotation,                               // 1
  // a_color.r,g,b,a                           // 4
  // a_type,                                   // 1
  // a_radius,                                 // 1
  // a_stroke,                                 // 1
  // a_dash.x, a_dash.y                        // 2
  // a_length                                  // 1
  // ---------------------------------------------------------
  // total = 15 floats per instance

  static readonly INSTANCE_STRIDE = 15;
  private buffer: Float32Array;
  private cursor = 0; // number of instances in buffer

  // temporary to avoid allocations
  //private tmpColor: Color = { r: 1, g: 1, b: 1, a: 1 };

  get gl() {
    return this.renderer.gl
  }

  constructor(renderer: Renderer, maxInstances = 8192) {
    this.renderer = renderer;
    this.maxInstances = maxInstances;

    // Ensure renderer has enough capacity; if not, it's user's responsibility to create with larger maxInstances
    this.buffer = new Float32Array(maxInstances * ShapeRenderer.INSTANCE_STRIDE);

    this.projectionMatrix = createOrthoMatrix(0, renderer.width, renderer.height, 0)

    this.maxInstances = maxInstances;

    let { gl } = this

    // 1 quad = 4 vertices
    this.quadVBO = gl.createBuffer()!;
    this.instanceVBO = gl.createBuffer()!;

    this.program = this.createProgram(
      VERT_SRC,
      FRAG_SRC
    );

    //this.uResolution = gl.getUniformLocation(this.program, "u_resolution");
    this.uProjectionMatrix = gl.getUniformLocation(this.program, "u_projection");


    // 36 floats per instance example (we will align later)
    this.instanceStride = 15; // You will expand this later
    this.instanceData = new Float32Array(this.maxInstances * this.instanceStride);

    this.vao = this.createVAO();

    this.setupInstancing()
  }

  /**
   * Must be called once before drawing any shapes
   */
  begin() {
    this.cursor = 0;
    // Any per-frame state resets would go here
  }

  /**
   * Must be called once after drawing all your shapes
   */
  end() {
    this.flush();
  }

  /**
   * Begins a mask mode
   * Must be called once before drawing a mask
   * 
   * @example
   * 
   * ```ts
   * batch.pushMask()
   * // draw mask
   * batch.fillRect(\/\* \*\/)
   * batch.endMask()
   * // draw shapes that the mask will be applied to
   * batch.fillRect(\/\* \*\/)
   * batch.popMask()
   * ```
   * 
   */
  pushMask() {
    this.flush()
    this.renderer.pushMask()
  }

  /**
   * Ends a mask mode
   * Must be called once after drawing your masked shapes
   */
  popMask() {
    this.flush()
    this.renderer.popMask()
  }

  /**
   * Ends the mask region definition
   * Must be called once in between pushMask and popMask
   */
  endMask() {
    this.flush()
    this.renderer.endMask()
  }

  private ensureCapacity(additional: number) {
    if (this.cursor + additional > this.maxInstances) {
      // flush existing data and continue
      this.flush();
      if (additional > this.maxInstances) {
        throw new Error("Requested instance count exceeds maxInstances");
      }
    }
  }

  private pushInstance(data: number[]) {
    // data length must equal stride
    const base = this.cursor * ShapeRenderer.INSTANCE_STRIDE;
    for (let i = 0; i < ShapeRenderer.INSTANCE_STRIDE; i++) {
      this.buffer[base + i] = data[i] ?? 0;
    }
    this.cursor++;
  }

  /** Fill rectangle (no stroke). rotation in radians. */
  fillRect(x: number, y: number, w: number, h: number, color: Color, rotation = 0) {
    this.ensureCapacity(1);
    const type = 0.0; // rect fill type
    const radius = 0.0;
    const stroke = 0.0;
    const dashX = 0.0, dashY = 0.0;
    const length = 0.0;

    this.pushInstance([
      x, y,
      w, h,
      rotation,
      color.r, color.g, color.b, color.a,
      type,
      radius,
      stroke,
      dashX, dashY,
      length
    ]);
  }

  /** Round rect fill */
  fillRoundRect(x: number, y: number, w: number, h: number, radiusPx: number, color: Color, rotation = 0) {
    this.ensureCapacity(1);
    const type = 1.0; // roundRect fill
    const stroke = 0.0;
    this.pushInstance([
      x, y,
      w, h,
      rotation,
      color.r, color.g, color.b, color.a,
      type,
      radiusPx,
      stroke,
      0.0, 0.0,
      0.0
    ]);
  }

  /** Stroke a rectangle (or any shape). strokeWidth is in px. dash: [dashLen,gapLen] */
  strokeRoundRect(x: number, y: number, w: number, h: number, radiusPx: number, strokeWidth: number, color: Color, dash: [number, number] = [0,0], rotation = 0) {
    this.ensureCapacity(1);
    const type = 1.0; // use roundRect SDF but with stroke>0
    this.pushInstance([
      x, y,
      w + strokeWidth, h + strokeWidth,
      rotation,
      color.r, color.g, color.b, color.a,
      type,
      radiusPx,
      strokeWidth,
      dash[0], dash[1],
      0.0
    ]);
  }

  /** Stroke rectangle without rounded corners using roundRect SDF with radius=0 */
  strokeRect(x: number, y: number, w: number, h: number, strokeWidth: number, color: Color, dash: [number, number] = [0,0], rotation = 0) {
    this.ensureCapacity(1);
    const type = 0.0; // rectangle type
    this.pushInstance([
      x, y,
      w + strokeWidth, h + strokeWidth,
      rotation,
      color.r, color.g, color.b, color.a,
      type,
      0.0,
      strokeWidth,
      dash[0], dash[1],
      0.0
    ]);
  }


  /** Stroke circle */
  fillCircle(x: number, y: number, radius: number, color: Color, dash: [number, number] = [0,0]) {
    this.ensureCapacity(1);
    const type = 3.0; // rectangle type
    let w = radius * 2
    let h = radius * 2
    this.pushInstance([
      x, y,
      w, h,
      0,
      color.r, color.g, color.b, color.a,
      type,
      radius,
      0.0,
      dash[0], dash[1],
      0.0
    ]);
  }

  /** Stroke circle */
  strokeCircle(x: number, y: number, radius: number, strokeWidth: number, color: Color, dash: [number, number] = [0,0]) {
    this.ensureCapacity(1);
    const type = 3.0; // rectangle type
    let w = radius * 2
    let h = radius * 2
    this.pushInstance([
      x, y,
      w + strokeWidth * 2, h + strokeWidth * 2,
      0,
      color.r, color.g, color.b, color.a,
      type,
      radius,
      strokeWidth,
      dash[0], dash[1],
      0.0
    ]);
  }



  /**
   * Stroke line with round caps (capsule).
   * (x1,y1) -> (x2,y2)
   * thickness = total pixel thickness
   * dash optional
   */
  strokeLine(x1: number, y1: number, x2: number, y2: number, thickness: number, color: Color, dash: [number, number] = [0,0]) {
    this.ensureCapacity(1);

    // compute length and rotation
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const rotation = Math.atan2(dy, dx);

    const quadW = len + thickness + 8
    const quadH = thickness + 8

    // For a capsule we position the instance center at midpoint
    const cx = (x1 + x2) * 0.5;
    const cy = (y1 + y2) * 0.5;

    const type = 2.0; // capsule line
    const radius = thickness * 0.5;
    const stroke = 0.0; // stroke=0 -> filled capsule (we consider line as filled capsule)
    this.pushInstance([
      cx, cy,
      quadW, quadH,
      rotation,
      color.r, color.g, color.b, color.a,
      type,
      radius,
      stroke,
      dash[0], dash[1],
      len // v_length used by capsule sdf
    ]);
  }

  private flush() {
    if (this.cursor === 0) return;
    // upload to renderer
    // renderer expects a Float32Array with consecutive instances in the same order
    // We will copy from our local buffer into renderer.instanceData and set the renderer.instanceCount then call renderer.flush

    const floatsToUpload = this.cursor * ShapeRenderer.INSTANCE_STRIDE;
    const uploadArray = this.buffer.subarray(0, floatsToUpload);

    // The renderer in Option A had this.instanceData and a method to bufferSubData in flush().
    // We'll write directly into renderer.instanceData (if space) else fall back to bufferSubData via a temporary.
    if (this.instanceData.length >= floatsToUpload) {
      // fast path: copy into renderer's instanceData
      this.instanceData.set(uploadArray, 0);
    } else {
      // (unlikely) allocate a temporary and let renderer.bufferSubData handle it
      // (Renderer.flush() does bufferSubData on the amount of instances)
      // we will set renderer.instanceData to a new array — keep it simple
      this.instanceData = new Float32Array(uploadArray); // minor reallocation
    }

    // Set count then call renderer.flush()
    this.instanceCount = this.cursor;
    this.renderer_flush();

    // reset cursor
    this.cursor = 0;
  }



  private createVAO(): WebGLVertexArrayObject {
    const gl = this.gl;
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);

    // --- Quad geometry (0..1) ---
    const quadVerts = new Float32Array([
      0, 0,
      1, 0,
      0, 1,
      1, 1
    ]);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
    gl.bufferData(gl.ARRAY_BUFFER, quadVerts, gl.STATIC_DRAW);

    // a_pos (vec2)
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
    gl.vertexAttribDivisor(0, 0); // per-vertex, not instanced

    // --- Instance buffer ---
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVBO);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      this.instanceData.byteLength,
      gl.DYNAMIC_DRAW
    );

    // Leave attribute pointers uninitialized for now.
    // We will define them in the "setupInstancing()" method.

    return vao;
  }

  private setupInstancing() {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVBO);

    const stride = this.instanceStride * 4;

    let offset = 0;
    let attribLoc = 1;

    const attrib = (size: number) => {
      gl.enableVertexAttribArray(attribLoc);
      gl.vertexAttribPointer(attribLoc, size, gl.FLOAT, false, stride, offset);
      gl.vertexAttribDivisor(attribLoc, 1);
      offset += size * 4;
      attribLoc++;
    };

    // These correspond exactly to shader attributes:
    attrib(2); // a_translation
    attrib(2); // a_size
    attrib(1); // a_rotation
    attrib(4); // a_color
    attrib(1); // a_type
    attrib(1); // a_radius
    attrib(1); // a_stroke
    attrib(2); // a_dash
    attrib(1); // a_length
  }

  renderer_flush() {
    const gl = this.gl;
    if (this.instanceCount === 0) return;

    gl.useProgram(this.program);
    gl.bindVertexArray(this.vao);

    gl.uniformMatrix4fv(this.uProjectionMatrix, false, this.projectionMatrix);

    // Upload only the needed part of the buffer
    gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVBO);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      this.instanceData.subarray(0, this.instanceCount * this.instanceStride)
    );

    gl.drawArraysInstanced(
      gl.TRIANGLE_STRIP,
      0,
      4,
      this.instanceCount
    );

    this.instanceCount = 0;
  }

  private createProgram(vertSrc: string, fragSrc: string): WebGLProgram {
    const gl = this.gl;

    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, vertSrc);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(vs)!);
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, fragSrc);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      throw new Error(gl.getShaderInfoLog(fs)!);
    }

    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog)!);
    }

    gl.deleteShader(vs);
    gl.deleteShader(fs);

    return prog;
  }


  cleanup() {
    const gl = this.gl;

    // 1. Unbind VAO
    gl.bindVertexArray(null);

    // 2. Delete VAO
    if (this.vao) {
      gl.deleteVertexArray(this.vao);
    }

    // 3. Unbind VBOs
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    // 4. Delete VBOs
    if (this.quadVBO) {
      gl.deleteBuffer(this.quadVBO);
    }

    if (this.instanceVBO) {
      gl.deleteBuffer(this.instanceVBO);
    }

    // 5. Delete shader program
    if (this.program) {
      gl.useProgram(null);
      gl.deleteProgram(this.program);
    }

    // 6. Delete any textures if you add them later
    /*
    if (this.texture) {
        gl.deleteTexture(this.texture);
        this.texture = null;
    }
    */

    // 7. Optional: Clear GL state
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);

    // Renderer object is now safe to be GC’d
  }


}
