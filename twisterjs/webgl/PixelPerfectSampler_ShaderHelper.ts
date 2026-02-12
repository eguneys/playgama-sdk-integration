export const PixelPerfectSampler_Helper_FS = `
vec2 pixelPerfectUV(sampler2D tex, vec2 uv) {
    vec2 size = vec2(textureSize(tex, 0));
    return (floor(uv * size) + 0.5) / size;
}
`