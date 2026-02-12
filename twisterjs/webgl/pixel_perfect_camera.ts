import { vec2 } from '../math/vec2'
import { Mat3 } from '../math/mat3'

export class PixelPerfectCamera2D {

    position = vec2()
    zoom = 1;

    private view = new Mat3();
    private projection = new Mat3();
    private viewProj = new Mat3();

    constructor(
        public viewportWidth: number,
        public viewportHeight: number
    ) {
        this.updateProjection();
    }

    setViewport(width: number, height: number) {
        this.viewportWidth = width;
        this.viewportHeight = height;
        this.updateProjection();
    }

    setZoom(zoom: number) {
        this.zoom = Math.max(1, Math.round(zoom));
    }

    setPosition(x: number, y: number) {
        // 🔴 CRITICAL: snap to integer pixels
        this.position.x = Math.round(x);
        this.position.y = Math.round(y);
    }

    private updateProjection() {
        // Orthographic projection in pixel space
        this.projection.identity();

        this.projection.scale(
            2 / this.viewportWidth,
           -2 / this.viewportHeight
        );

        this.projection.translate(-1, 1);
    }

    update() {
        // View matrix
        this.view.identity();

        // 🔴 Half-pixel offset to align pixel centers
        this.view.translate(
            -this.position.x + 0.5,
            -this.position.y + 0.5
        );

        this.view.scale(this.zoom, this.zoom);

        // viewProj = projection * view
        this.viewProj.identity();
        this.viewProj.multiply(this.projection);
        this.viewProj.multiply(this.view);
    }

    getMatrix(): Float32Array {
        return this.viewProj.data;
    }

    getMatrix4(): Float32Array {

    const m = this.viewProj.data;

    // Column-major mat4
    return new Float32Array([
        // column 0
        m[0], m[1], 0, 0,

        // column 1
        m[3], m[4], 0, 0,

        // column 2 (Z axis)
        0,    0,    1, 0,

        // column 3 (translation)
        m[6], m[7], 0, 1
    ]);
}

}
