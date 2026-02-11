export class Camera2D {

    private gl: WebGL2RenderingContext;
    private ubo: WebGLBuffer;

    // Camera properties
    public x = 0;
    public y = 0;
    public zoom = 1;
    public rotation = 0;

    private projection = new Float32Array(16);
    private view = new Float32Array(16);
    private viewProjection = new Float32Array(16);

    private inverseViewProjection = new Float32Array(16);


    constructor(gl: WebGL2RenderingContext) {

        this.gl = gl;

        this.ubo = gl.createBuffer()!;
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo);
        gl.bufferData(gl.UNIFORM_BUFFER, 16 * 4, gl.DYNAMIC_DRAW);
        gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, this.ubo);
    }

    zoomAt(worldX: number, worldY: number, zoomFactor: number) {

        const oldZoom = this.zoom;
        const newZoom = zoomFactor;

        // Optional clamp
        this.zoom = Math.max(0.1, Math.min(newZoom, 10));

        const scale = oldZoom / this.zoom;

        this.x = worldX - (worldX - this.x) * scale;
        this.y = worldY - (worldY - this.y) * scale;
    }


    worldToScreen(
        worldX: number,
        worldY: number,
        canvasWidth: number,
        canvasHeight: number
    ): { x: number, y: number } {

        const m = this.viewProjection;

        // Transform to clip space
        const clipX =
            worldX * m[0] +
            worldY * m[4] +
            m[12];

        const clipY =
            worldX * m[1] +
            worldY * m[5] +
            m[13];

        // Convert clip (-1..1) to screen pixels
        const screenX =
            (clipX + 1) * 0.5 * canvasWidth;

        const screenY =
            (1 - clipY) * 0.5 * canvasHeight;

        return { x: screenX, y: screenY };
    }


    screenToWorld(
        screenX: number,
        screenY: number,
        canvasWidth: number,
        canvasHeight: number
    ): { x: number, y: number } {

        const ndcX =
            (screenX / canvasWidth) * 2 - 1;

        const ndcY =
            -(screenY / canvasHeight) * 2 + 1;

        const m = this.inverseViewProjection;

        const x =
            ndcX * m[0] +
            ndcY * m[4] +
            m[12];

        const y =
            ndcX * m[1] +
            ndcY * m[5] +
            m[13];

        return { x, y };
    }



    // ===============================
    // Projection
    // ===============================

    setOrthographic(
        left: number,
        right: number,
        bottom: number,
        top: number,
        near = -1,
        far = 1
    ) {

        const m = this.projection;

        m[0]  = 2 / (right - left);
        m[1]  = 0;
        m[2]  = 0;
        m[3]  = 0;

        m[4]  = 0;
        m[5]  = 2 / (top - bottom);
        m[6]  = 0;
        m[7]  = 0;

        m[8]  = 0;
        m[9]  = 0;
        m[10] = -2 / (far - near);
        m[11] = 0;

        m[12] = -(right + left) / (right - left);
        m[13] = -(top + bottom) / (top - bottom);
        m[14] = -(far + near) / (far - near);
        m[15] = 1;
    }

    // ===============================
    // Update (Pan + Zoom applied)
    // ===============================

    update() {

        const cos = Math.cos(-this.rotation);
        const sin = Math.sin(-this.rotation);

        const z = this.zoom;

        const tx = -this.x;
        const ty = -this.y;

        const v = this.view;

        // Build view matrix manually (column-major)

        v[0] =  cos * z;
        v[1] =  sin * z;
        v[2] =  0;
        v[3] =  0;

        v[4] = -sin * z;
        v[5] =  cos * z;
        v[6] =  0;
        v[7] =  0;

        v[8]  = 0;
        v[9]  = 0;
        v[10] = 1;
        v[11] = 0;

        v[12] = tx * v[0] + ty * v[4];
        v[13] = tx * v[1] + ty * v[5];
        v[14] = 0;
        v[15] = 1;

        this.multiply(this.viewProjection, this.projection, this.view);

        this.invert(this.inverseViewProjection, this.viewProjection);


        const gl = this.gl;
        gl.bindBuffer(gl.UNIFORM_BUFFER, this.ubo);
        gl.bufferSubData(gl.UNIFORM_BUFFER, 0, this.viewProjection);
    }

    // ===============================
    // Matrix Multiply
    // ===============================

    private multiply(
        out: Float32Array,
        a: Float32Array,
        b: Float32Array
    ) {
        for (let i = 0; i < 4; i++) {
            for (let j = 0; j < 4; j++) {
                out[i*4 + j] =
                    a[j]   * b[i*4] +
                    a[4+j] * b[i*4+1] +
                    a[8+j] * b[i*4+2] +
                    a[12+j]* b[i*4+3];
            }
        }
    }

    private invert(out: Float32Array, m: Float32Array) {

        const inv = new Float32Array(16);

        inv[0] = m[5] * m[10] * m[15] -
            m[5] * m[11] * m[14] -
            m[9] * m[6] * m[15] +
            m[9] * m[7] * m[14] +
            m[13] * m[6] * m[11] -
            m[13] * m[7] * m[10];

        inv[4] = -m[4] * m[10] * m[15] +
            m[4] * m[11] * m[14] +
            m[8] * m[6] * m[15] -
            m[8] * m[7] * m[14] -
            m[12] * m[6] * m[11] +
            m[12] * m[7] * m[10];

        inv[8] = m[4] * m[9] * m[15] -
            m[4] * m[11] * m[13] -
            m[8] * m[5] * m[15] +
            m[8] * m[7] * m[13] +
            m[12] * m[5] * m[11] -
            m[12] * m[7] * m[9];

        inv[12] = -m[4] * m[9] * m[14] +
            m[4] * m[10] * m[13] +
            m[8] * m[5] * m[14] -
            m[8] * m[6] * m[13] -
            m[12] * m[5] * m[10] +
            m[12] * m[6] * m[9];

        const det = m[0] * inv[0] +
            m[1] * inv[4] +
            m[2] * inv[8] +
            m[3] * inv[12];

        const invDet = 1.0 / det;

        for (let i = 0; i < 16; i++) {
            out[i] = inv[i] * invDet;
        }
    }

    getFrustumBounds(): {
        left: number,
        right: number,
        top: number,
        bottom: number
    } {

        const halfWidth = 1 / this.zoom;
        const halfHeight = 1 / this.zoom;

        // This assumes projection was symmetric
        // If you want exact values, compute from inverseViewProjection

        return {
            left: this.x - halfWidth,
            right: this.x + halfWidth,
            bottom: this.y - halfHeight,
            top: this.y + halfHeight
        };
    }

}

export function intersects(
    leftA: number,
    rightA: number,
    bottomA: number,
    topA: number,
    leftB: number,
    rightB: number,
    bottomB: number,
    topB: number
): boolean {
    return !(
        rightA < leftB ||
        leftA > rightB ||
        topA < bottomB ||
        bottomA > topB
    );
}
