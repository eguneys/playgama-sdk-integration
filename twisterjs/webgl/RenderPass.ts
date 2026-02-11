import { Camera2D } from "./camera2d";

export interface RenderCommand {
    type: string;
    pass: string;
    layer: number;
    depth: number;
}


export class RenderQueue {


    private passes = new Map<string, ScenePass>();
    private commands: RenderCommand[] = [];

    constructor(public gl: WebGL2RenderingContext, private width: number, private height: number) {}

    submit<T extends RenderCommand>(cmd: T) {
        this.commands.push(cmd)
    }

    addPass(
        name: string,
        options?: {
            target?: RenderTarget;
            camera?: Camera2D;
        }
    ): ScenePass {

        const camera =
            options?.camera ?? new Camera2D(this.gl);

        const target =
            options?.target ?? new ScreenTarget(this.gl, this.width, this.height);

        const pass =
            new ScenePass(name, camera, target);

        this.passes.set(name, pass);

        return pass;
    }


    flush() {
        for (const pass of this.passes.values()) {

            const passCommands =
                this.commands.filter(c => c.pass === pass.name);

            pass.execute(this.gl, passCommands);
        }

        this.commands.length = 0;
    }
}






export interface RenderTarget {
    bind(): void;
}


export class FramebufferTarget implements RenderTarget {

    readonly framebuffer: WebGLFramebuffer;
    readonly texture: WebGLTexture;

    private gl: WebGL2RenderingContext;
    width: number;
    height: number;

    constructor(
        gl: WebGL2RenderingContext,
        width: number,
        height: number
    ) {
        this.gl = gl;
        this.width = width;
        this.height = height;

        const fb = gl.createFramebuffer()!;
        gl.bindFramebuffer(gl.FRAMEBUFFER, fb);

        gl.viewport(0, 0, this.width, this.height)

        const tex = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, tex);

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

        /*
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        */

        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);


        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            tex,
            0
        );

        this.framebuffer = fb;
        this.texture = tex;

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    bind() {

        this.gl.bindTexture(this.gl.TEXTURE_2D, null)
        this.gl.bindFramebuffer(
            this.gl.FRAMEBUFFER,
            this.framebuffer
        );
        this.gl.viewport(0, 0, this.width, this.height)
    }
}

export class ScreenTarget implements RenderTarget {

    constructor(private gl: WebGL2RenderingContext, private width: number, private height: number) {}

    bind() {
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        this.gl.viewport(0, 0, this.width, this.height)
    }
}

export class ScenePass {

    readonly name: string;
    readonly camera: Camera2D;
    readonly target: RenderTarget;

    private renderers: IRenderer<any>[] = [];

    constructor(
        name: string,
        camera: Camera2D,
        target: RenderTarget,
    ) {
        this.name = name;
        this.camera = camera;
        this.target = target;
    }

    addRenderer<T extends RenderCommand>(renderer: IRenderer<T>) {
        this.renderers.push(renderer);
    }

    execute(gl: WebGL2RenderingContext, commands: RenderCommand[]) {

        this.target.bind();
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        this.camera.update();

        const grouped = new Map<string, RenderCommand[]>();

        for (const cmd of commands) {
            if (!grouped.has(cmd.type)) {
                grouped.set(cmd.type, []);
            }
            grouped.get(cmd.type)!.push(cmd);
        }

        for (const renderer of this.renderers) {

            renderer.begin();

            const cmds = grouped.get(renderer.type);

            if (cmds) {
                for (const cmd of cmds) {
                    renderer.submit(cmd);
                }
            }

            renderer.end();
        }

    }
}

export interface IRenderer<T extends RenderCommand> {
    readonly type: T["type"];
    begin(): void;
    submit(cmd: T): void;
    end(): void;
}


import * as FSs from './FullScreen_Shaders'

export class FullscreenQuadRenderer {

    private gl: WebGL2RenderingContext;
    private vao: WebGLVertexArrayObject;

    constructor(gl: WebGL2RenderingContext) {

        this.gl = gl;

        this.vao = gl.createVertexArray()!;
        gl.bindVertexArray(this.vao);

        const vertices = new Float32Array([
            -1, -1,  0, 0,
             1, -1,  1, 0,
             1,  1,  1, 1,
            -1,  1,  0, 1
        ]);

        const indices = new Uint16Array([0,1,2, 2,3,0]);



        const vbo = gl.createBuffer()!;
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        const ebo = gl.createBuffer()!;
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);

        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 4*4, 0);

        gl.enableVertexAttribArray(1);
        gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 4*4, 2*4);

        gl.bindVertexArray(null);

        this.init_shaders()

    }

    copy_shader!: WebGLProgram
    bright_shader!: WebGLProgram
    blur_shader!: WebGLProgram
    composite_shader!: WebGLProgram

    private uniforms = {
        copy: {} as { uTexture: WebGLUniformLocation},
        bright: {} as { uTexture: WebGLUniformLocation, uThreshold: WebGLUniformLocation },
        blur: {} as { uTexture: WebGLUniformLocation, uDirection: WebGLUniformLocation, uTexelSize: WebGLUniformLocation },
        composite: {} as { uScene: WebGLUniformLocation, uBloom: WebGLUniformLocation, uIntensity: WebGLUniformLocation },
    }

    private init_shaders() {
        this.copy_shader = this.createShader(FSs.Copy_FS)
        this.bright_shader = this.createShader(FSs.BrightExtractionPass_FS)
        this.blur_shader = this.createShader(FSs.GaussianBlur_FS)
        this.composite_shader = this.createShader(FSs.Composite_FS)

        this.uniforms.copy.uTexture = this.gl.getUniformLocation(this.copy_shader, 'uAtlas')!

        this.uniforms.bright.uTexture = this.gl.getUniformLocation(this.bright_shader, 'uScene')!
        this.uniforms.bright.uThreshold = this.gl.getUniformLocation(this.bright_shader, 'uThreshold')!

        this.uniforms.blur.uTexture = this.gl.getUniformLocation(this.blur_shader, 'uTexture')!
        this.uniforms.blur.uDirection = this.gl.getUniformLocation(this.blur_shader, 'uDirection')!
        this.uniforms.blur.uTexelSize = this.gl.getUniformLocation(this.blur_shader, 'uTexelSize')!

        this.uniforms.composite.uScene = this.gl.getUniformLocation(this.composite_shader, 'uScene')!
        this.uniforms.composite.uBloom = this.gl.getUniformLocation(this.composite_shader, 'uBloom')!
        this.uniforms.composite.uIntensity = this.gl.getUniformLocation(this.composite_shader, 'uIntensity')!



    }

    renderCopy(texture: WebGLTexture) {

        const gl = this.gl;

        let program = this.copy_shader
        gl.useProgram(program);
        gl.bindVertexArray(this.vao);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);

        gl.uniform1i(this.uniforms.copy.uTexture, 0)

        gl.drawElements(
            gl.TRIANGLES,
            6,
            gl.UNSIGNED_SHORT,
            0
        );
    }

    renderBright(texture: WebGLTexture, threshold: number) {

        const gl = this.gl;

        gl.disable(gl.BLEND);

        gl.useProgram(this.bright_shader);
        gl.bindVertexArray(this.vao);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);

        gl.uniform1i(this.uniforms.bright.uTexture, 0);
        gl.uniform1f(this.uniforms.bright.uThreshold, threshold);

        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }

    renderBlur(
        texture: WebGLTexture,
        horizontal: boolean,
        texelWidth: number,
        texelHeight: number
    ) {

        const gl = this.gl;

        gl.useProgram(this.blur_shader);
        gl.bindVertexArray(this.vao);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);

        gl.uniform1i(this.uniforms.blur.uTexture, 0);

        gl.uniform2f(
            this.uniforms.blur.uDirection,
            horizontal ? 1 : 0,
            horizontal ? 0 : 1
        );

        gl.uniform2f(
            this.uniforms.blur.uTexelSize,
            texelWidth,
            texelHeight
        );

        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }

    renderComposite(
        scene: WebGLTexture,
        bloom: WebGLTexture,
        intensity: number
    ) {

        const gl = this.gl;

        gl.useProgram(this.composite_shader);
        gl.bindVertexArray(this.vao);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, scene);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, bloom);

        gl.uniform1i(this.uniforms.composite.uScene, 0);
        gl.uniform1i(this.uniforms.composite.uBloom, 1);

        gl.uniform1f(this.uniforms.composite.uIntensity, intensity);

        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    }


    private createShader(fragmentSrc: string): WebGLProgram {

        const gl = this.gl;

        const vertexSrc = `#version 300 es
        layout(location = 0) in vec2 aPos;
        layout(location = 1) in vec2 aUV;
        out vec2 vUV;
        void main() {
            vUV = aUV;
            gl_Position = vec4(aPos, 0, 1);
        }`;

        const vs = this.compile(gl.VERTEX_SHADER, vertexSrc);
        const fs = this.compile(gl.FRAGMENT_SHADER, fragmentSrc);

        const program = gl.createProgram()!;
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error(gl.getProgramInfoLog(program)!);
        }


        return program;
    }

    private compile(type: number, src: string) {
        const gl = this.gl;
        const s = gl.createShader(type)!;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            throw new Error(gl.getShaderInfoLog(s)!);
        }


        return s;
    }
}

export interface SceneRenderer {
    readonly type: RenderCommand["type"];

    begin(): void;
    submit(cmd: RenderCommand): void;
    end(): void;
}

export interface PostProcessPass {
    execute(input: WebGLTexture | null): WebGLTexture | null;
}


export class PostProcessStage {

    constructor(private passes: PostProcessPass[]) {}

    execute(inputTexture: WebGLTexture) {
        let currentTexture = inputTexture;

        for (const pass of this.passes) {
            currentTexture =
                pass.execute(currentTexture)!;
        }

        return currentTexture;
    }
}

export class CopyPass implements PostProcessPass {

    constructor(
        private gl: WebGL2RenderingContext,
        private quad: FullscreenQuadRenderer
    ) {}

    execute(inputTexture: WebGLTexture) {

        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height)
        this.quad.renderCopy(inputTexture)

        return null; // final output
    }
}


export class BloomPass implements PostProcessPass {

    private brightTarget: FramebufferTarget;
    private ping: FramebufferTarget;
    private pong: FramebufferTarget;

    constructor(
        gl: WebGL2RenderingContext,
        private quad: FullscreenQuadRenderer,
        width: number,
        height: number
    ) {

        this.brightTarget = new FramebufferTarget(gl, width, height);
        this.ping = new FramebufferTarget(gl, width, height);
        this.pong = new FramebufferTarget(gl, width, height);
    }

    public u_threshold = 0.64
    public u_intensity = 1.1
    public blur_iterations = 6

    execute(sceneTexture: WebGLTexture) {

        const u_texelWidth = 1 / this.ping.width
        const u_texelHeight = 1/ this.ping.height

        let { u_threshold,
            u_intensity
        } = this

        // 1️⃣ Bright extract
        this.brightTarget.bind();

        this.quad.renderBright(sceneTexture, u_threshold);

        // 2️⃣ Blur ping-pong
        let horizontal = true;
        let inputTex = this.brightTarget.texture;

        const blurIterations = this.blur_iterations

        for (let i = 0; i < blurIterations; i++) {

            const target = horizontal ? this.ping : this.pong;
            target.bind();

            this.quad.renderBlur(inputTex, horizontal, u_texelWidth, u_texelHeight)

            inputTex = target.texture;
            horizontal = !horizontal;
        }


        this.ping.bind()
        this.quad.renderComposite(sceneTexture, inputTex, u_intensity)
        return this.ping.texture
    }
}
