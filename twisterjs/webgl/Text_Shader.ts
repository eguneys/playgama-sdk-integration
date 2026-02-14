export const Text_VS = `#version 300 es
layout(location=0) in vec2 aPos;
layout(location=1) in vec2 aUV;

uniform vec2 uScreenSize;
uniform vec2 uPosition;
uniform vec2 uSize;

out vec2 vUV;

void main() {
    vec2 pos = uPosition + aPos * uSize;
    vec2 ndc = (pos / uScreenSize) * 2.0 - 1.0;
    gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
    vUV = aUV;
}

`

export const Text_FS = `#version 300 es
precision highp float;

uniform sampler2D uText;
in vec2 vUV;

out vec4 fragColor;

void main() {
    fragColor = texture(uText, vUV);
}
`