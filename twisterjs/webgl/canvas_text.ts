import type { Color } from './color';
import { createShader } from './light'
import type { IRenderer, RenderCommand } from './RenderPass';
import { Text_VS, Text_FS } from './Text_Shader'

export interface TextRegion {
    texture: WebGLTexture;
    u0: number;
    v0: number;
    u1: number;
    v1: number;
    width: number;
    height: number;
}

export class CanvasTextAtlas {

    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;

    private texture: WebGLTexture;

    private atlasWidth: number;
    private atlasHeight: number;

    private cursorX = 0;
    private cursorY = 0;
    private lineHeight = 0;

    private dirty = false;

    private cache = new Map<string, TextRegion>();

    constructor(
        private gl: WebGL2RenderingContext,
        width = 1024,
        height = 1024
    ) {
        this.atlasWidth = width;
        this.atlasHeight = height;

        this.canvas = document.createElement("canvas");
        this.canvas.width = width;
        this.canvas.height = height;

        this.ctx = this.canvas.getContext("2d")!;
        this.ctx.textBaseline = "top";
        this.ctx.textAlign = "left";
        this.ctx.fillStyle = "#ffffff";

        const glTex = gl.createTexture();
        if (!glTex) throw new Error("Failed to create text atlas texture");
        this.texture = glTex;

        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            width,
            height,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null
        );

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    /**
     * Main entry point:
     * returns a cached atlas region for the given text + style.
     */
    getTextRegion(
        text: string,
        font: string,
        color: string
    ): TextRegion {

        const key = `${font}|${color}|${text}`;
        const cached = this.cache.get(key);
        if (cached) return cached;

        this.ctx.font = font;
        this.ctx.fillStyle = color;

        const metrics = this.ctx.measureText(text);

        const width = Math.ceil(metrics.width);
        const height = Math.ceil(
            metrics.actualBoundingBoxAscent +
            metrics.actualBoundingBoxDescent
        );

        // Simple row packing
        if (this.cursorX + width >= this.atlasWidth) {
            this.cursorX = 0;
            this.cursorY += this.lineHeight;
            this.lineHeight = 0;
        }

        if (this.cursorY + height >= this.atlasHeight) {
            throw new Error(
                "CanvasTextAtlas overflow. Increase atlas size or implement paging."
            );
        }

        let ascent = metrics.actualBoundingBoxAscent

        const x = this.cursorX;
        const y = this.cursorY;

        // Clear then draw text
        this.ctx.clearRect(x, y, width, height);
        this.ctx.fillText(text, x, y + ascent + 1);
        console.log(width, this.atlasWidth, height, this.atlasHeight)

        const u0 = (x + 0.5) / this.atlasWidth;
        const v0 = (y + 0.5) / this.atlasHeight;
        const u1 = (x + width - 0.5) / this.atlasWidth;
        const v1 = (y + height - 0.5) / this.atlasHeight;

        const region: TextRegion = {
            texture: this.texture,
            u0,
            v0,
            u1,
            v1,
            width,
            height
        };

        this.cache.set(key, region);

        this.cursorX += width + 2; // small padding
        this.lineHeight = Math.max(this.lineHeight, height);

        this.dirty = true;

        return region;
    }

    /**
     * Uploads atlas contents to GPU if new text was added.
     * Call once per frame before rendering text.
     */
    flush() {
        if (!this.dirty) return;

        const gl = this.gl;

        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.texSubImage2D(
            gl.TEXTURE_2D,
            0,
            0,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            this.canvas
        );

        this.dirty = false;
    }

    /**
     * Clears all cached text and resets packing.
     * Useful when switching fonts/themes.
     */
    clear() {
        this.ctx.clearRect(0, 0, this.atlasWidth, this.atlasHeight);
        this.cache.clear();
        this.cursorX = 0;
        this.cursorY = 0;
        this.lineHeight = 0;
        this.dirty = true;
    }
}




export interface TextDrawCommand extends RenderCommand {
    text: string;
    x: number;
    y: number;

    font?: string;
    color?: Color;

    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
}


export class TextRenderer implements IRenderer<TextDrawCommand> {
    type = 'text'

    begin(): void {
    }
    submit(cmd: TextDrawCommand): void {
        this.drawText(cmd)
    }
    end(): void {
        this.atlas.flush()
    }


    private gl: WebGL2RenderingContext;

    private program: WebGLProgram;
    private vao: WebGLVertexArrayObject;
    private vbo: WebGLBuffer;

    private uScreenSize: WebGLUniformLocation;
    private uPosition: WebGLUniformLocation;
    private uSize: WebGLUniformLocation;
    private uUV: WebGLUniformLocation;
    private uTexture: WebGLUniformLocation;

    constructor(
        gl: WebGL2RenderingContext,
        private atlas: CanvasTextAtlas,
        private screenWidth: number,
        private screenHeight: number
    ) {
        this.gl = gl;

        this.program = createShader(
            gl,
            Text_VS,
            Text_FS
        );

        // Quad: (0,0) → (1,1)
        const vertices = new Float32Array([
            // pos      uv
            0, 0,       0, 0,
            1, 0,       1, 0,
            1, 1,       1, 1,
            0, 1,       0, 1,
        ]);

        this.vao = gl.createVertexArray()!;
        this.vbo = gl.createBuffer()!;

        gl.bindVertexArray(this.vao);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        const stride = 4 * 4;

        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, stride, 0);

        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 2 * 4);

        gl.bindVertexArray(null);

        this.uScreenSize = gl.getUniformLocation(this.program, "uScreenSize")!;
        this.uPosition   = gl.getUniformLocation(this.program, "uPosition")!;
        this.uSize       = gl.getUniformLocation(this.program, "uSize")!;
        this.uUV         = gl.getUniformLocation(this.program, "uUV")!;
        this.uTexture    = gl.getUniformLocation(this.program, "uTexture")!;
    }
    setScreenSize(w: number, h: number) {
        this.screenWidth = w;
        this.screenHeight = h;
    }

    drawText(cmd: TextDrawCommand) {

        const gl = this.gl;

        const font = cmd.font ?? "16px sans-serif";
        const color = cmd.color?.css ?? "#ffffff";
        const align = cmd.align ?? "left";
        const baseline = cmd.baseline ?? "top";

        // Get shaped text from atlas
        const region = this.atlas.getTextRegion(
            cmd.text,
            font,
            color
        );

        let x = cmd.x;
        let y = cmd.y;

        // Alignment handling
        if (align === "center") x -= region.width / 2;
        else if (align === "right") x -= region.width;

        if (baseline === "middle") y -= region.height / 2;
        else if (baseline === "bottom") y -= region.height;

        gl.useProgram(this.program);
        gl.bindVertexArray(this.vao);

        gl.uniform2f(this.uScreenSize, this.screenWidth, this.screenHeight);
        gl.uniform2f(this.uPosition, x, y);
        gl.uniform2f(this.uSize, region.width, region.height);
        gl.uniform4f(this.uUV, region.u0, region.v0, region.u1, region.v1);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, region.texture);
        gl.uniform1i(this.uTexture, 0);

        gl.disable(gl.DEPTH_TEST);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

        gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);

        gl.bindVertexArray(null);
    }
}
