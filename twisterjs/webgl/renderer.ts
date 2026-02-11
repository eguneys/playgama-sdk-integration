export class Renderer {
    gl: WebGL2RenderingContext;

    maskDepth = 0


    constructor(public width: number, public height: number, canvas: HTMLCanvasElement) {
        const gl = canvas.getContext("webgl2", { antialias: true, stencil: true });
        if (!gl) throw new Error("WebGL2 not supported");
        this.gl = gl;

    }

    set_viewport(width: number, height: number) {
        this.gl.viewport(0, 0, width, height)
    }
    pushMask() {
        const gl = this.gl
        gl.enable(gl.STENCIL_TEST)

        gl.colorMask(false, false, false, false)

        gl.stencilFunc(gl.ALWAYS, this.maskDepth + 1, 0xFF)
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE)
    }


    endMask() {
        const gl = this.gl
        gl.colorMask(true, true, true, true)

        this.maskDepth++

        gl.stencilFunc(gl.EQUAL, this.maskDepth, 0xFF)
        gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP)
    }

    popMask() {
        this.maskDepth--

        const gl = this.gl

        if (this.maskDepth > 0) {
            gl.stencilFunc(gl.EQUAL, this.maskDepth, 0xFF)
        } else {
            gl.disable(gl.STENCIL_TEST)
        }
    }

}