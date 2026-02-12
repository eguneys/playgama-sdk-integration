export class CameraUBO {

    private buffer: WebGLBuffer;
    private readonly bindingPoint = 0;

    constructor(private gl: WebGL2RenderingContext) {

        this.buffer = gl.createBuffer()!;

        gl.bindBuffer(gl.UNIFORM_BUFFER, this.buffer);
        gl.bufferData(
            gl.UNIFORM_BUFFER,
            16 * 4, // mat3 = 9 floats
            gl.DYNAMIC_DRAW
        );

        gl.bindBufferBase(
            gl.UNIFORM_BUFFER,
            this.bindingPoint,
            this.buffer
        );
    }

    update(matrix: Float32Array) {
        const gl = this.gl;
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.buffer);
        gl.bufferSubData(gl.UNIFORM_BUFFER, 0, matrix);
    }

    bindToProgram(program: WebGLProgram) {
        const gl = this.gl;

        const blockIndex = gl.getUniformBlockIndex(
            program,
            "Camera"
        );

        if (blockIndex === gl.INVALID_INDEX) return;

        gl.uniformBlockBinding(
            program,
            blockIndex,
            this.bindingPoint
        );
    }
}
