export class PixelPerfectSampler {

    static atlasUV(
        x: number,
        y: number,
        w: number,
        h: number,
        texW: number,
        texH: number
    ) {
        const invW = 1 / texW;
        const invH = 1 / texH;

        return {
            u0: (x + 0.5) * invW,
            v0: (y + 0.5) * invH,
            u1: (x + w - 0.5) * invW,
            v1: (y + h - 0.5) * invH,
        };
    }
}
