import { TextureAtlas } from "./TextureAtlas";

export class Sprite {

    readonly atlas: TextureAtlas;
    readonly uvMin: [number, number];
    readonly uvMax: [number, number];
    readonly width: number;
    readonly height: number;

    constructor(
        atlas: TextureAtlas,
        regionName: string
    ) {
        const region = atlas.getRegion(regionName);

        this.atlas = atlas;
        this.uvMin = region.uvMin;
        this.uvMax = region.uvMax;
        this.width = region.width;
        this.height = region.height;
    }
}
