export const Shadow_VS = `#version 300 es
layout(location=0) in vec2 aPos;

uniform float uTileSize;

void main() {

    vec2 ndc = (aPos / uTileSize) * 2.0 - 1.0;
    gl_Position = vec4(ndc, 0.0, 1.0);
}
`


export const Light_VS = `#version 300 es
layout(location=0) in vec2 aPos;

out vec2 vUV;

void main() {

    // Convert NDC quad (-1..1) into UV (0..1)
    vUV = aPos * 0.5 + 0.5;

    gl_Position = vec4(aPos, 0.0, 1.0);
}
`;


export const Light_FS = `#version 300 es
precision highp float;

in vec2 vUV;
uniform vec3 uColor;
uniform float uRadius;
uniform float uTime;

out vec4 fragColor;

void main() {
    float dist = length(vUV - vec2(0.5));
    float intensity = 1.0 - smoothstep(0.0, uRadius, dist);


    intensity *= 0.9 + 0.1 * sin(uTime * 10.0);

    float levels = 4.0;

    intensity = floor(intensity * levels) / levels;

    fragColor = vec4(uColor * intensity, 1.0);
}

`
export const Shadow_FS = `#version 300 es
precision highp float;

out vec4 fragColor;

void main() {

    vec3 shadow = vec3(0.05, 0.08, 0.12);
    shadow = vec3(0.005, 0.008, 0.01);
    //shadow = vec3(0.0);
    fragColor = vec4(shadow, 1.0);



}

`


export const LightPlacement_VS = `#version 300 es
layout(location=0) in vec2 aPos;
layout(location=1) in vec2 iPosition;
layout(location=2) in float iRadius;
layout(location=3) in vec4 iAtlasUV;

layout(std140) uniform Camera {
    mat4 uViewProjection;
};



out vec2 vUV;

void main() {

    vec2 worldPos = iPosition + aPos * iRadius;
    gl_Position = uViewProjection * vec4(worldPos, 0.0, 1.0);

    vec2 localUV = aPos * 0.5 + 0.5;
    vUV = mix(iAtlasUV.xy, iAtlasUV.zw, localUV);
}
`

export const LightPlacement_FS = `#version 300 es
precision highp float;

uniform sampler2D uAtlas;

in vec2 vUV;
out vec4 fragColor;

void main() {




    fragColor = texture(uAtlas, vUV);



}

`