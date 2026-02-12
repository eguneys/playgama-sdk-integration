import { PixelPerfectSampler_Helper_FS } from "./PixelPerfectSampler_ShaderHelper"
export const Composite_VS = `#version 300 es
layout(location=0) in vec2 aPos;

out vec2 vUV;

void main() {
    vUV = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
}
`

export const Composite_FS = `#version 300 es
precision highp float;

in vec2 vUV;

uniform sampler2D uBackground;
uniform sampler2D uForeground;

out vec4 fragColor;


${PixelPerfectSampler_Helper_FS}

void main() {

    vec4 bg = texture(uBackground, pixelPerfectUV(uBackground, vUV));
    vec4 fg = texture(uForeground, pixelPerfectUV(uForeground, vUV));

    fragColor = fg + bg * (1.0 - fg.a);
}

`