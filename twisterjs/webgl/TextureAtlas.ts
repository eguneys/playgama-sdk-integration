
export interface AtlasRegion {
    uvMin: [number, number];
    uvMax: [number, number];
    width: number;
    height: number;
}

export type AtlasJson = {

    frames: Record<string, { 
        frame: { x: number, y: number, w: number, h: number }
    }>
}

/**
 * 
 * 
 * @example
 *
 * const atlas =
    TextureAtlas.fromImageAndJSON(
        gl,
        image,
        json,
        {
            pixelArt: true,
            paddingFix: false
        }
    );

const region = atlas.getRegion("player_idle");

spriteRenderer.draw({
    texture: atlas.texture,
    uvMin: region.uvMin,
    uvMax: region.uvMax,
    x: 100,
    y: 200,
    width: region.width,
    height: region.height
});
 * 
 */
export class TextureAtlas {

    readonly texture: WebGLTexture;
    readonly width: number;
    readonly height: number;

    private regions = new Map<string, AtlasRegion>();

    private constructor(
        texture: WebGLTexture,
        width: number,
        height: number
    ) {
        this.texture = texture;
        this.width = width;
        this.height = height;
    }

    // =========================================
    // Static Factory
    // =========================================

    static fromImageAndJSON(
        gl: WebGL2RenderingContext,
        image: HTMLImageElement,
        atlasJSON: AtlasJson,
        options?: {
            pixelArt?: boolean,
            paddingFix?: boolean
        }
    ): TextureAtlas {

        const texture = gl.createTexture()!;
        gl.bindTexture(gl.TEXTURE_2D, texture);

        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            image
        );

        const pixelArt = options?.pixelArt ?? false;

        gl.texParameteri(
            gl.TEXTURE_2D,
            gl.TEXTURE_MIN_FILTER,
            pixelArt ? gl.NEAREST : gl.LINEAR
        );

        gl.texParameteri(
            gl.TEXTURE_2D,
            gl.TEXTURE_MAG_FILTER,
            pixelArt ? gl.NEAREST : gl.LINEAR
        );

        gl.texParameteri(
            gl.TEXTURE_2D,
            gl.TEXTURE_WRAP_S,
            gl.CLAMP_TO_EDGE
        );

        gl.texParameteri(
            gl.TEXTURE_2D,
            gl.TEXTURE_WRAP_T,
            gl.CLAMP_TO_EDGE
        );

        const width = image.width;
        const height = image.height;

        const atlas =
            new TextureAtlas(texture, width, height);

        atlas.parseRegions(atlasJSON, options?.paddingFix);

        return atlas;
    }

    // =========================================
    // Region Access
    // =========================================

    getRegion(name: string): AtlasRegion {
        const region = this.regions.get(name);
        if (!region) {
            throw new Error(
                `Region '${name}' not found in atlas`
            );
        }
        return region;
    }

    hasRegion(name: string): boolean {
        return this.regions.has(name);
    }

    // =========================================
    // Internal Parsing
    // =========================================

    private parseRegions(
        atlasJSON: AtlasJson,
        paddingFix?: boolean
    ) {

        const frames = atlasJSON.frames;

        for (const key in frames) {

            const frame = frames[key].frame;

            let x = frame.x;
            let y = frame.y;
            let w = frame.w;
            let h = frame.h;

            if (paddingFix) {
                // Shrink UVs slightly to avoid bleeding
                x += 0.5;
                y += 0.5;
                w -= 1.0;
                h -= 1.0;
            }

            const u0 = x / this.width;
            const v0 = y / this.height;
            const u1 = (x + w) / this.width;
            const v1 = (y + h) / this.height;

            this.regions.set(key, {
                uvMin: [u0, v0],
                uvMax: [u1, v1],
                width: frame.w,
                height: frame.h
            });
        }
    }
}
