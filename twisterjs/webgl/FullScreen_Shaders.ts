export const Copy_FS = `#version 300 es
precision mediump float;

in vec2 vUV;

uniform sampler2D uAtlas;

out vec4 outColor;

void main() {
    vec4 texColor =
        texture(uAtlas, vUV);
    outColor = texColor;
}`;


export const BrightExtractionPass_FS = `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragColor;

uniform sampler2D uScene;
uniform float uThreshold;

void main() {

    vec3 color = texture(uScene, vUV).rgb;

    float brightness = dot(color, vec3(0.2126, 0.7152, 0.0722));

    if (brightness > uThreshold)
        fragColor = vec4(color, 1.0);
    else
        fragColor = vec4(0.0);
}
`

export const GaussianBlur_FS = `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragColor;

uniform sampler2D uTexture;
uniform vec2 uDirection;  // (1,0) or (0,1)
uniform vec2 uTexelSize;

void main() {

    vec3 result = texture(uTexture, vUV).rgb * 0.227027;

    result += texture(uTexture, vUV + uDirection * uTexelSize * 1.384615).rgb * 0.316216;
    result += texture(uTexture, vUV - uDirection * uTexelSize * 1.384615).rgb * 0.316216;

    result += texture(uTexture, vUV + uDirection * uTexelSize * 3.230769).rgb * 0.070270;
    result += texture(uTexture, vUV - uDirection * uTexelSize * 3.230769).rgb * 0.070270;

    fragColor = vec4(result, 1.0);
}
`

export const Composite_FS = `#version 300 es
precision highp float;

in vec2 vUV;
out vec4 fragColor;

uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uIntensity;

void main() {

    vec3 scene = texture(uScene, vUV).rgb;
    vec3 bloom = texture(uBloom, vUV).rgb;

    vec3 finalColor = scene + bloom * uIntensity;

    fragColor = vec4(finalColor, 1.0);
}
`

export const Multiply_VS = `#version 300 es
        layout(location=0) in vec2 aPos;

        out vec2 vUV;

        void main() {
            vUV = aPos * 0.5 + 0.5;
            gl_Position = vec4(aPos, 0.0, 1.0);
        }`;

        export const Multiply_FS = `#version 300 es
        precision highp float;

        in vec2 vUV;

        uniform sampler2D uScene;
        uniform sampler2D uLight;

        out vec4 fragColor;

        void main() {
            vec4 sceneColor = texture(uScene, vUV);
            vec4 lightColor = texture(uLight, vUV);

            fragColor = sceneColor * lightColor;
        }`
