import { type IRenderer, type RenderCommand } from './RenderPass'
import { Sprite } from './Sprite'
import type { TextureAtlas } from './TextureAtlas';
import { Color } from './color'

/*
vec2  position        (2)
vec2  size            (2)
float rotation        (1)
vec2  origin          (2)
vec2  uvMin           (2)
vec2  uvMax           (2)
vec4  color           (4)
float depth           (1)
--------------------------------
Total = 16 floats
*/

export class SpriteRenderer implements IRenderer<SpriteCommand> {
    readonly type = "sprite"

    private gl: WebGL2RenderingContext;

    private vao!: WebGLVertexArrayObject;
    private quadVBO!: WebGLBuffer;
    private instanceVBO!: WebGLBuffer;
    private ebo!: WebGLBuffer;

    private shader: WebGLProgram;

    private maxInstances: number;
    private instanceData: Float32Array;
    private instanceCount = 0;

    private readonly FLOATS_PER_INSTANCE = 17;

    private uAtlasUniformLoc: WebGLUniformLocation

    constructor(gl: WebGL2RenderingContext, public atlas: TextureAtlas, maxInstances = 5000) {

        this.gl = gl;
        this.maxInstances = maxInstances;
        this.instanceData =
            new Float32Array(maxInstances * this.FLOATS_PER_INSTANCE);

        this.shader = this.createShader();

        this.uAtlasUniformLoc = gl.getUniformLocation(this.shader, "uAtlas")!

        this.createBuffers();
        this.setupVAO();
    }

    submit(cmd: SpriteCommand): void {
        if (cmd.sprite.atlas !== this.atlas) {
            return
        }
        this.draw(cmd)
    }

    // =========================================
    // Public API
    // =========================================

    begin() {

        let { gl } = this
        gl.enable(gl.BLEND);
        //gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
        this.instanceCount = 0;

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.atlas.texture);
    }

    draw(options: SpriteCommand) {

        if (this.instanceCount >= this.maxInstances) {
            this.flush();
        }

        let scale_x = options.scale ?? options.scaleX ?? 1
        let scale_y = options.scale ?? options.scaleY ?? 1
        let width = options.sprite.width * scale_x
        let height = options.sprite.height * scale_y

        const {
            x,
            y,
            rotation = 0,
            originX = 0.5,
            originY = 0.5,
            color = { r: 1, g: 1, b: 1, a: 1 },
            depth = 0
        } = options;

        let { uvMin, uvMax }  = options.sprite

        const base =
            this.instanceCount * this.FLOATS_PER_INSTANCE;

        let i = base;

        // position
        this.instanceData[i++] = x;
        this.instanceData[i++] = y;

        // size
        this.instanceData[i++] = width;
        this.instanceData[i++] = height;

        // rotation
        this.instanceData[i++] = rotation;

        // origin
        this.instanceData[i++] = originX;
        this.instanceData[i++] = originY;

        // uvMin
        this.instanceData[i++] = uvMin[0];
        this.instanceData[i++] = uvMin[1];

        // uvMax
        this.instanceData[i++] = uvMax[0];
        this.instanceData[i++] = uvMax[1];

        // color
        this.instanceData[i++] = color.r;
        this.instanceData[i++] = color.g;
        this.instanceData[i++] = color.b;
        this.instanceData[i++] = color.a;

        // depth
        this.instanceData[i++] = depth;

        this.instanceCount++;
    }

    end() {
        this.flush();
    }

    // =========================================
    // Flush
    // =========================================

    private flush() {

        if (this.instanceCount === 0) return;

        const gl = this.gl;

        gl.useProgram(this.shader);
        gl.bindVertexArray(this.vao);

        // Upload instance data
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVBO);
        gl.bufferSubData(
            gl.ARRAY_BUFFER,
            0,
            this.instanceData.subarray(
                0,
                this.instanceCount *
                this.FLOATS_PER_INSTANCE
            )
        );


        const loc = this.uAtlasUniformLoc
        gl.uniform1i(loc, 0);

        gl.drawElementsInstanced(
            gl.TRIANGLES,
            6,
            gl.UNSIGNED_INT,
            0,
            this.instanceCount
        );

        this.instanceCount = 0;
    }

    // =========================================
    // Setup
    // =========================================

    private createBuffers() {

        const gl = this.gl;

        // Unit quad
        const quad = new Float32Array([
            -0.5, -0.5,  0.0, 0.0,
             0.5, -0.5,  1.0, 0.0,
             0.5,  0.5,  1.0, 1.0,
            -0.5,  0.5,  0.0, 1.0
        ]);

        const indices = new Uint32Array([
            0,1,2,
            2,3,0
        ]);

        this.quadVBO = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
        gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);

        this.ebo = gl.createBuffer()!;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ebo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

        this.instanceVBO = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVBO);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            this.maxInstances *
            this.FLOATS_PER_INSTANCE * 4,
            gl.DYNAMIC_DRAW
        );
    }

    private setupVAO() {

        const gl = this.gl;

        this.vao = gl.createVertexArray()!;
        gl.bindVertexArray(this.vao);

        // Static quad
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);

        // aLocalPos (0)
        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 4*4, 0);

        // aLocalUV (1)
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 4*4, 2*4);

        // Instance data
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVBO);

        const stride = this.FLOATS_PER_INSTANCE * 4;
        let offset = 0;
        let loc = 2;

        const attrib = (size: number) => {
            gl.enableVertexAttribArray(loc);
            gl.vertexAttribPointer(
                loc,
                size,
                gl.FLOAT,
                false,
                stride,
                offset
            );
            gl.vertexAttribDivisor(loc, 1);
            offset += size * 4;
            loc++;
        };

        attrib(2); // position
        attrib(2); // size
        attrib(1); // rotation
        attrib(2); // origin
        attrib(2); // uvMin
        attrib(2); // uvMax
        attrib(4); // color
        attrib(1); // texIndex
        attrib(1); // depth

        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ebo);

        gl.bindVertexArray(null);
    }

    // =========================================
    // Shader
    // =========================================

    private createShader(): WebGLProgram {

        const gl = this.gl;

        const vertexSrc = `#version 300 es

        layout(location = 0) in vec2 aLocalPos;
        layout(location = 1) in vec2 aLocalUV;

        layout(location = 2) in vec2 iPosition;
        layout(location = 3) in vec2 iSize;
        layout(location = 4) in float iRotation;
        layout(location = 5) in vec2 iOrigin;
        layout(location = 6) in vec2 iUVMin;
        layout(location = 7) in vec2 iUVMax;
        layout(location = 8) in vec4 iColor;
        layout(location = 10) in float iDepth;

        layout(std140) uniform Camera {
            mat4 uViewProjection;
        };

        out vec2 vUV;
        out vec4 vColor;

        void main() {

            vec2 scaled = aLocalPos * iSize;
            vec2 originOffset =
                (iOrigin - 0.5) * iSize;
            scaled -= originOffset;

            float c = cos(iRotation);
            float s = sin(iRotation);

            vec2 rotated = vec2(
                scaled.x * c - scaled.y * s,
                scaled.x * s + scaled.y * c
            );

            vec2 worldPos = rotated + iPosition;

            gl_Position =
                uViewProjection *
                vec4(worldPos, iDepth, 1.0);

            vUV = mix(iUVMin, iUVMax, aLocalUV);
            vColor = iColor;
        }`;

        const fragmentSrc = `#version 300 es
        precision mediump float;

        in vec2 vUV;
        in vec4 vColor;

        uniform sampler2D uAtlas;

        out vec4 outColor;

        void main() {
            vec4 texColor =
                texture(uAtlas, vUV);
            outColor = texColor * vColor;
        }`;

        const vs = this.compile(gl.VERTEX_SHADER, vertexSrc);
        const fs = this.compile(gl.FRAGMENT_SHADER, fragmentSrc);

        const program = gl.createProgram()!;
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);


        return program;
    }

    private compile(type: number, src: string): WebGLShader {
        const gl = this.gl;
        const shader = gl.createShader(type)!;
        gl.shaderSource(shader, src);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(shader)!);
        }


        return shader;
    }
}


export interface SpriteCommand extends RenderCommand {
    type: "sprite";

    sprite: Sprite;

    x: number;
    y: number;
    scaleX?: number;
    scaleY?: number;
    scale?: number

    rotation: number;
    originX?: number;
    originY?: number;

    color?: Color
}