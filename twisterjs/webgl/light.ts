import type { Vec2 } from '../math/vec2';
import { Light_FS, Light_VS, LightPlacement_FS, LightPlacement_VS, Shadow_FS, Shadow_VS } from './Light_Shader';
import { PixelPerfectSampler } from './PixelPerfectSampler';
import type { RenderTarget } from './RenderPass';


export interface Light {
    atlasIndex: number
    position: { x: number; y: number };
    radius: number;
    color: { r: number; g: number; b: number };
    time: number
}

export interface OccluderEdge {
    a: { x: number; y: number };
    b: { x: number; y: number };
}



export class LightAtlas {

    readonly texture: WebGLTexture;
    readonly framebuffer: WebGLFramebuffer;

    readonly atlasSize: number;
    readonly tileSize: number;
    readonly tilesPerRow: number;

    private nextIndex = 0;

    constructor(
        private gl: WebGL2RenderingContext,
        atlasSize: number = 2048,
        tileSize: number = 256
    ) {
        this.atlasSize = atlasSize;
        this.tileSize = tileSize;
        this.tilesPerRow = atlasSize / tileSize;

        this.texture = this.createTexture();
        this.framebuffer = this.createFramebuffer();
    }

    reset() {
        this.nextIndex = 0
    }

    allocateTile(): number {
        return this.nextIndex++;
    }

    getTileViewport(index: number) {

        const x = (index % this.tilesPerRow) * this.tileSize;
        const y = Math.floor(index / this.tilesPerRow) * this.tileSize;

        return { x, y, size: this.tileSize };
    }

    getTileUV(index: number) {

        const viewport = this.getTileViewport(index);

        let { u0, v0, u1, v1 } = PixelPerfectSampler.atlasUV(viewport.x, viewport.y, viewport.size, viewport.size, this.atlasSize, this.atlasSize)

        return { u0, v0, u1, v1 };
    }

    private createTexture(): WebGLTexture {

        const gl = this.gl;
        const tex = gl.createTexture()!;

        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA8,
            this.atlasSize,
            this.atlasSize,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null
        );

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        return tex;
    }

    private createFramebuffer(): WebGLFramebuffer {

        const gl = this.gl;
        const fb = gl.createFramebuffer()!;

        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            this.texture,
            0
        );

        return fb;
    }
}

export class LightAtlasPass {

    constructor(
        private gl: WebGL2RenderingContext,
        private atlas: LightAtlas,
        private lightRenderer: LightRenderer = new LightRenderer(gl),
        private shadowRenderer: ShadowRenderer = new ShadowRenderer(gl)
    ) {}

    execute(lights: Light[], occluders: OccluderEdge[]) {

        const gl = this.gl;

        gl.bindFramebuffer(gl.FRAMEBUFFER, this.atlas.framebuffer);

        for (const light of lights) {

            const tileIndex = this.atlas.allocateTile();
            const vp = this.atlas.getTileViewport(tileIndex);

            light.atlasIndex = tileIndex;

            // Set viewport for drawing
            gl.viewport(vp.x, vp.y, vp.size, vp.size);

            // Restrict clear to tile region
            gl.enable(gl.SCISSOR_TEST);
            gl.scissor(vp.x, vp.y, vp.size, vp.size);

            gl.clearColor(0, 0, 0, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);

            gl.disable(gl.SCISSOR_TEST);

            gl.disable(gl.BLEND)


            this.lightRenderer.drawLocal(light, vp.size);

            this.shadowRenderer.begin(vp.size)

            for (let occ of occluders) {
                this.shadowRenderer.submitQuad(this.generateShadowQuad(occ, light, vp.size))
            }

            this.shadowRenderer.flush()
        }
        this.atlas.reset()
    }

    private generateShadowQuad(
        edge: OccluderEdge,
        light: Light,
        tileSize: number
    ): { x: number, y: number }[] {

        const lx = light.position.x;
        const ly = light.position.y;

        // Convert world edge into light-local space
        const ax = edge.a.x - lx;
        const ay = edge.a.y - ly;

        const bx = edge.b.x - lx;
        const by = edge.b.y - ly;

        // Normalize directions
        const lenA = Math.hypot(ax, ay);
        const lenB = Math.hypot(bx, by);

        const dirAx = ax / lenA;
        const dirAy = ay / lenA;

        const dirBx = bx / lenB;
        const dirBy = by / lenB;

        // Push shadow far away
        const shadowLength = tileSize * 2;

        const farA = {
            x: ax + dirAx * shadowLength,
            y: ay + dirAy * shadowLength
        };

        const farB = {
            x: bx + dirBx * shadowLength,
            y: by + dirBy * shadowLength
        };

        // Convert to tile pixel space
        const center = tileSize / 2;

        return [
            { x: ax + center, y: ay + center },
            { x: bx + center, y: by + center },
            { x: farB.x + center, y: farB.y + center },
            { x: farA.x + center, y: farA.y + center }
        ];
    }

}


export class LightCompositePass {

    constructor(
        private gl: WebGL2RenderingContext,
        private atlas: LightAtlas,
        private compositeRenderer: LightPlacementRenderer = new LightPlacementRenderer(gl),
        private target: RenderTarget
    ) {}

    execute(lights: Light[]) {

        let ambient = 0.5
        const gl = this.gl;

        this.target.bind();

        gl.disable(gl.BLEND);
        gl.clearColor(ambient, ambient, ambient, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);

        this.compositeRenderer.begin()

        for (const light of lights) {

            const uv = this.atlas.getTileUV(light.atlasIndex);

            this.compositeRenderer.submitLight(light, uv)
        }
        this.compositeRenderer.flush(this.atlas.texture)
    }
}

export class LightRenderer {

    private program: WebGLProgram
    private uColor: WebGLUniformLocation
    private uRadius: WebGLUniformLocation
    private uTime: WebGLUniformLocation


    private vao: WebGLVertexArrayObject;
    private vbo: WebGLBuffer;

    constructor(private gl: WebGL2RenderingContext) {

        this.program = createShader(gl, Light_VS, Light_FS)

        this.uColor = gl.getUniformLocation(this.program, 'uColor')!
        this.uRadius = gl.getUniformLocation(this.program, 'uRadius')!
        this.uTime = gl.getUniformLocation(this.program, 'uTime')!



        const vertices = new Float32Array([
            -1, -1,
             1, -1,
             1,  1,
            -1,  1
        ]);

        this.vao = gl.createVertexArray()!;
        gl.bindVertexArray(this.vao);

        this.vbo = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

        gl.bindVertexArray(null);
    }

    drawFullscreenQuad() {

        const gl = this.gl;

        gl.bindVertexArray(this.vao);

        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

        gl.bindVertexArray(null);
    }

    drawLocal(light: Light, tileSize: number) {

        const gl = this.gl;

        gl.useProgram(this.program);

        gl.uniform3f(this.uColor,
            light.color.r,
            light.color.g,
            light.color.b
        );

        gl.uniform1f(this.uRadius, light.radius / tileSize);
        gl.uniform1f(this.uTime, light.time);

        this.drawFullscreenQuad();
    }
}


export class ShadowRenderer {

    private vao: WebGLVertexArrayObject;
    private vbo: WebGLBuffer;
    private program: WebGLProgram;

    private vertexData: Float32Array;
    private quadCount = 0;

    private readonly MAX_QUADS = 2048;

    private uTileSize: WebGLUniformLocation

    constructor(private gl: WebGL2RenderingContext) {

        this.vertexData = new Float32Array(this.MAX_QUADS * 6 * 2);

        // --- Create Shader ---
        this.program = createShader(gl, Shadow_VS, Shadow_FS)
        this.uTileSize = gl.getUniformLocation(this.program, 'uTileSize')!


        // --- Create VAO ---
        this.vao = gl.createVertexArray()!;
        gl.bindVertexArray(this.vao);

        this.vbo = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            this.vertexData.byteLength,
            gl.DYNAMIC_DRAW
        );

        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

        gl.bindVertexArray(null);
    }

    tileSize!: number
    begin(tileSize: number) {
        this.quadCount = 0;
        this.tileSize = tileSize
    }

    submitQuad(quad: Vec2[]) {

        if (this.quadCount >= this.MAX_QUADS)
            return;

        const offset = this.quadCount * 12;

        // Expand quad into 2 triangles:
        // A B C
        // A C D

        this.vertexData.set([
            quad[0].x, quad[0].y,
            quad[1].x, quad[1].y,
            quad[2].x, quad[2].y,

            quad[0].x, quad[0].y,
            quad[2].x, quad[2].y,
            quad[3].x, quad[3].y
        ], offset);

        this.quadCount++;
    }

    flush() {

        const gl = this.gl;

        if (this.quadCount === 0) return;

        gl.useProgram(this.program);   // ✅ Correct place


        gl.uniform1f(this.uTileSize, this.tileSize)

        gl.bindVertexArray(this.vao);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bufferSubData(
            gl.ARRAY_BUFFER,
            0,
            this.vertexData.subarray(0, this.quadCount * 12)
        );


        gl.drawArrays(
            gl.TRIANGLES,
            0,
            this.quadCount * 6
        );

        gl.bindVertexArray(null);
    }

}

interface AtlasUV {
    u0: number;
    v0: number;
    u1: number;
    v1: number;
}


/*
position (2)
radius   (1)
padding  (1)
atlasUV  (4)
*/
export class LightPlacementRenderer {

    private program: WebGLProgram;

    private vao: WebGLVertexArrayObject;
    private quadVBO: WebGLBuffer;
    private instanceVBO: WebGLBuffer;

    private instanceData: Float32Array;
    private instanceCount = 0;

    private readonly MAX_LIGHTS = 256;

    private uAtlas!: WebGLUniformLocation;

    constructor(private gl: WebGL2RenderingContext) {

        const quadVertices = new Float32Array([
            -1, -1,
             1, -1,
             1,  1,
            -1,  1
        ]);

        this.instanceData = new Float32Array(this.MAX_LIGHTS * 8);

        this.vao = gl.createVertexArray()!;
        gl.bindVertexArray(this.vao);

        // ---- Quad VBO ----
        this.quadVBO = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVBO);
        gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

        // ---- Instance VBO ----
        this.instanceVBO = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVBO);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            this.instanceData.byteLength,
            gl.DYNAMIC_DRAW
        );

        const stride = 8 * 4;

        // position (vec2)
        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 0);
        gl.vertexAttribDivisor(1, 1);

        // radius (float)
        gl.enableVertexAttribArray(2);
        gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 2 * 4);
        gl.vertexAttribDivisor(2, 1);

        // atlasUV (vec4)
        gl.enableVertexAttribArray(3);
        gl.vertexAttribPointer(3, 4, gl.FLOAT, false, stride, 4 * 4);
        gl.vertexAttribDivisor(3, 1);

        gl.bindVertexArray(null);

        // ---- Shader ----
        this.program = createShader(gl, LightPlacement_VS, LightPlacement_FS);

        this.uAtlas = gl.getUniformLocation(this.program, "uAtlas")!;
    }

    begin() {
        this.instanceCount = 0;
    }

    submitLight(light: Light, uv: AtlasUV) {

        const offset = this.instanceCount * 8;

        this.instanceData.set([
            light.position.x,
            light.position.y,
            light.radius,
            0, // padding
            uv.u0,
            uv.v0,
            uv.u1,
            uv.v1
        ], offset);

        this.instanceCount++;
    }

    flush(atlasTexture: WebGLTexture) {

        const gl = this.gl;

        if (this.instanceCount === 0) return;

        gl.useProgram(this.program);

        // ---- Bind atlas texture ----
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, atlasTexture);
        gl.uniform1i(this.uAtlas, 0);

        gl.bindVertexArray(this.vao);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.instanceVBO);
        gl.bufferSubData(
            gl.ARRAY_BUFFER,
            0,
            this.instanceData.subarray(0, this.instanceCount * 8)
        );

        gl.drawArraysInstanced(
            gl.TRIANGLE_FAN,
            0,
            4,
            this.instanceCount
        );

        gl.bindVertexArray(null);
    }
}





export function createShader(gl: WebGL2RenderingContext, vertexSrc: string, fragmentSrc: string): WebGLProgram {

    const vs = compileShader(gl, gl.VERTEX_SHADER, vertexSrc);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSrc);

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program)!);
    }

    return program;
}

export function compileShader(gl: WebGL2RenderingContext, type: number, src: string) {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(s)!);
    }
    return s;
}