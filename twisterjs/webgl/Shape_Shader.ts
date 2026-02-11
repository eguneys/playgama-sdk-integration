export const VERT_SRC = `
#version 300 es
precision highp float;

layout(location = 0) in vec2 a_pos;            // quad vertex (0-1 space)
layout(location = 1) in vec2 a_translation;    // world position
layout(location = 2) in vec2 a_size;           // width, height
layout(location = 3) in float a_rotation;      // radians
layout(location = 4) in vec4 a_color;          // RGBA
layout(location = 5) in float a_type;          // shape type
layout(location = 6) in float a_radius;        // roundRect radius or line thickness*0.5
layout(location = 7) in float a_stroke;        // stroke width (0 = fill)
layout(location = 8) in vec2 a_dash;           // (dashLength, gapLength)
layout(location = 9) in float a_length;        // shape length for lines (distance between A→B)

out vec2 v_local;
out vec2 v_size;
out vec4 v_color;
out float v_type;
out float v_radius;
out float v_stroke;
out vec2 v_dash;
out float v_length;

uniform mat4 u_projection; // 1920x1080 Orto Matrix

void main() {
    // Convert quad coordinates (0..1) to local space (-0.5..0.5)
    vec2 local = (a_pos - 0.5) * a_size;
    v_local = local;
    v_size = a_size;

    // Pass instance data to fragment shader
    v_color = a_color;
    v_type = a_type;
    v_radius = a_radius;
    v_stroke = a_stroke;
    v_dash = a_dash;
    v_length = a_length;

    // Rotation
    float s = sin(a_rotation);
    float c = cos(a_rotation);
    vec2 rotated = vec2(
        local.x * c - local.y * s,
        local.x * s + local.y * c
    );

    // Final world position
    vec2 world = rotated + a_translation;

    // convert pixel pos to NDC
    //vec2 ndc = (world / u_resolution) * 2.0 - 1.0;
    vec4 ndc = u_projection * vec4(world, 0.0, 1.0);
    //gl_Position = vec4(ndc * vec2(1, -1), 0.0, 1.0);
    gl_Position = ndc;
}
`.trim()

export const FRAG_SRC = `
#version 300 es
precision highp float;

in vec2 v_local;
in vec2 v_size;
in vec4 v_color;
in float v_type;
in float v_radius;
in float v_stroke;
in vec2 v_dash;
in float v_length;

out vec4 fragColor;

// ************** SDF UTILITIES ************** //

float sdRect(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return max(d.x, d.y);
}

float sdRoundRect(vec2 p, vec2 b, float r) {
    vec2 d = abs(p) - b + vec2(r);
    return length(max(d, 0.0)) - r;
}

float sdCapsule(vec2 p, float len, float r) {
    // Capsule along +X axis centered at origin
    vec2 a = vec2(-len * 0.5, 0.0);
    vec2 b = vec2( len * 0.5, 0.0);
    vec2 pa = p - a;
    vec2 ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}

float sdCircle(vec2 p, float r) {
    return length(p) - r;
}

float applyDash(float distAlongLine, float dash, float gap) {
    float total = dash + gap;
    float m = mod(distAlongLine, total);
    return (m < dash) ? 1.0 : 0.0;
}


void main() {

    // Normalize local coords to center
    vec2 p = v_local;

    float d = 0.0;

    //--------------------------------------------------
    // RECTANGLE
    //--------------------------------------------------
    if (v_type == 0.0) {
        d = sdRect(p, v_size * 0.5);
    }

    //--------------------------------------------------
    // ROUND RECTANGLE
    //--------------------------------------------------
    if (v_type == 1.0) {
        d = sdRoundRect(p, v_size * 0.5 - vec2(v_radius), v_radius);
    }

    //--------------------------------------------------
    // CAPSULE LINE (round caps)
    //--------------------------------------------------
    if (v_type == 2.0) {
        // line thickness = v_radius*2
        d = sdCapsule(p, v_length, v_radius);
    }

    if (v_type == 3.0) {
        d = sdCircle(p, v_radius);
    }

    //--------------------------------------------------
    // STROKE / FILL HANDLING
    //--------------------------------------------------
    float alpha = 0.0;

    if (v_stroke == 0.0) {
        // FILL SHAPE
        float edge = fwidth(d) * 1.2;
        edge = max(edge, 1.0);
        alpha = 1.0 - smoothstep(0.0, edge, d);
    } else {
        // STROKE SHAPE
        float halfStroke = v_stroke * 0.5;
        float distToStroke = abs(d) - halfStroke;
    
        float edge = fwidth(distToStroke) * 1.2;
        edge = max(edge, 1.0);
        alpha = 1.0 - smoothstep(0.0, edge, distToStroke);
    
        //--------------------------------------------------
        // DASHING (ANTI-ALIASED, STABLE)
        //--------------------------------------------------
        if (v_dash.x > 0.0 && alpha > 0.0) {
    
            // ---------------------------------------------
            // Arc-length approximation
            // ---------------------------------------------
            float s;
    
            if (v_type == 2.0) {
                // line / rect-like shapes: project along x
                s = p.x + v_length * 0.5;
            } else {
                // fallback: radial distance (better than Manhattan)
                s = length(p);
            }
    
            // ---------------------------------------------
            // Dash pattern
            // ---------------------------------------------
            float period = v_dash.x + v_dash.y;
            float phase  = mod(s, period);
    
            // derivative-aware AA for dash edges
            float dashEdge = fwidth(s);
    
            float dashMask =
                1.0 - smoothstep(
                    v_dash.x - dashEdge,
                    v_dash.x + dashEdge,
                    phase
                );
    
            alpha *= dashMask;
        }
    }

    float a= v_color.a * alpha;
    fragColor = vec4(v_color.rgb * a, a);
}

`.trim()