struct MyUniforms {
    frameNumber: f32,
    scale: vec2f,
    position: vec2f
};

@group(0) @binding(0) var<uniform> uniforms: MyUniforms;

struct VertexInput {
    @builtin(vertex_index) VertexIndex: u32,
    @builtin(instance_index) InstanceIndex: u32
};

struct VertexOutput {
    @builtin(position) Position: vec4<f32>,
    @location(0) color: vec4<f32>,
    @location(1) localPosition: vec2<f32>,
    @location(2) instanceScale: vec2<f32>,
    @location(3) instanceRadius: f32
};

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var out: VertexOutput; 
    var position: vec2<f32> = positions[input.InstanceIndex];
    var opacity: f32 = 1.0;

    if (input.InstanceIndex == 23u) {
        position.x = ((uniforms.frameNumber % 30) / 30) - 0.5;
    }

    if (input.InstanceIndex == 24u) {
       opacity = 1 - (((uniforms.frameNumber + 105) % 120) / 15);
    }

    if (input.InstanceIndex == 25u) {
       opacity = 1 - (((uniforms.frameNumber + 75) % 120) / 15);
    }

    if (input.InstanceIndex == 26u) {
       opacity = 1 - (((uniforms.frameNumber + 45) % 120) / 15);
    }
    
    if (input.InstanceIndex == 27u) {
       opacity = 1 - (((uniforms.frameNumber + 15) % 120) / 15);
    }

    let instance_pos = baseTriangles[input.VertexIndex] * scales[input.InstanceIndex] + position;
    let zoomed_pos = instance_pos * uniforms.scale + uniforms.position;


    out.Position = vec4<f32>(zoomed_pos, 0.0, 1.0);
    out.color = vec4<f32>(colors[input.InstanceIndex], opacity);
    out.localPosition = baseTriangles[input.VertexIndex];
    out.instanceScale = scales[input.InstanceIndex];
    out.instanceRadius = radii[input.InstanceIndex];
    return out;
}

struct FragmentInput {
    @location(0) color: vec4<f32>,
    @location(1) localPosition: vec2<f32>, // Coordinates from -1.0 to 1.0
    @location(2) instanceScale: vec2<f32>,
    @location(3) instanceRadius: f32
};

@fragment
fn fragmentMain(input:FragmentInput) -> @location(0) vec4<f32> {
    let borderRadius = input.instanceRadius; 
    let screen_aspect = 1.777; // 16:9
    let edgeSoftness = 0.005;

    let normalisedRadius = borderRadius / input.instanceScale.y;
    if (normalisedRadius < 0.00001) {
        return vec4<f32>(input.color);
    }
    
    let distance = roundedBoxSDF(input.localPosition, input.instanceScale, borderRadius, screen_aspect);
    if (input.instanceScale.y == 0.0) {
        discard; 
    }

    let smoothedAlpha = 1.0 - smoothstep(-edgeSoftness, edgeSoftness, distance);
    if (smoothedAlpha < 0.01) {
        discard;
    }
    
    return vec4<f32>(input.color.rgb, input.color.a * smoothedAlpha);
}

fn roundedBoxSDF(uv: vec2<f32>, scale: vec2<f32>, borderRadius: f32, screen_aspect: f32) -> f32 {
   let normalisedRadius = borderRadius / scale.y;
    let instanceAspect = scale.x / scale.y;
    let p_normalized = uv * 0.5; 
    
    // Screen Aspect Correction
    var p = p_normalized;
    p.x *= screen_aspect;
    p.x *= instanceAspect;
    let b = vec2<f32>(0.5 * screen_aspect * instanceAspect, 0.5);

    // Guard Against Zero Radius 
    if (normalisedRadius < 0.00001) {
        let q = abs(p) - b;
        return length(max(q, vec2<f32>(0.0))) + min(max(q.x, q.y), 0.0);
    }
    
    //Rounded Box SDF 
    let d = abs(p) - b + normalisedRadius;
    return length(max(d, vec2<f32>(0.0))) + min(max(d.x, d.y), 0.0) - normalisedRadius;

}

const instanceCount: u32 = 32;

const baseTriangles = array<vec2<f32>, 6>(
    vec2<f32>( 1,  1),
    vec2<f32>( 1, -1),
    vec2<f32>(-1, -1),
    vec2<f32>( 1,  1),
    vec2<f32>(-1, -1),
    vec2<f32>(-1,  1)
);

const colors = array<vec3<f32>, instanceCount>(
    vec3<f32>(0.08, 0.08, 0.08), //bg
    vec3<f32>(0, 0, 1), // blue
    vec3<f32>(1, 0, 0), // red
    vec3<f32>(1, 0, 1), // purple
    vec3<f32>(0, 1, 0), // green
    vec3<f32>(0, 1, 1), // cyan
    vec3<f32>(1, 1, 0), // yellow
    vec3<f32>(0, 0, 0), // black
    vec3<f32>(0.2, 0.2, 0.2), 
    vec3<f32>(0.4, 0.4, 0.4), 
    vec3<f32>(0.6, 0.6, 0.6), 
    vec3<f32>(0.8, 0.8, 0.8), 
    vec3<f32>(1, 1, 1), // white
    vec3<f32>(0.2, 0.2, 0.2), 
    vec3<f32>(0.2, 0.2, 0.2), 
    vec3<f32>(0.2, 0.2, 0.2), 
    vec3<f32>(0.2, 0.2, 0.2), 
    vec3<f32>(0.2, 0.2, 0.2), 
    vec3<f32>(0.2, 0.2, 0.2), 
    vec3<f32>(0.2, 0.2, 0.2), 
    vec3<f32>(0.2, 0.2, 0.2), 
    vec3<f32>(1, 1, 1),
    vec3<f32>(1, 1, 1),
    vec3<f32>(1, 1, 1),
    vec3<f32>(1, 1, 1),
    vec3<f32>(1, 1, 1),
    vec3<f32>(1, 1, 1),
    vec3<f32>(1, 1, 1),
    vec3<f32>(0.08, 0.08, 0.08),
    vec3<f32>(0.08, 0.08, 0.08),
    vec3<f32>(0.08, 0.08, 0.08),
    vec3<f32>(0.08, 0.08, 0.08)
);

const scales = array<vec2<f32>, instanceCount>(
    vec2<f32>(1, 1),
    vec2<f32>(0.056, 0.1),
    vec2<f32>(0.056, 0.1),
    vec2<f32>(0.056, 0.1),
    vec2<f32>(0.056, 0.1),
    vec2<f32>(0.056, 0.1),
    vec2<f32>(0.056, 0.1),
    vec2<f32>(0.056, 0.1),
    vec2<f32>(0.056, 0.1),
    vec2<f32>(0.056, 0.1),
    vec2<f32>(0.056, 0.1),
    vec2<f32>(0.056, 0.1),
    vec2<f32>(0.056, 0.1),
    vec2<f32>(0.018, 0.3),
    vec2<f32>(0.018, 0.3),
    vec2<f32>(0.018, 0.3),
    vec2<f32>(0.018, 0.3),
    vec2<f32>(0.168, 0.033),
    vec2<f32>(0.168, 0.033),
    vec2<f32>(0.168, 0.033),
    vec2<f32>(0.168, 0.033),
    vec2<f32>(0.003, 0.02),
    vec2<f32>(0.003, 0.02),
    vec2<f32>(0.016, 0.08),
    vec2<f32>(0.084, 0.15),
    vec2<f32>(0.084, 0.15),
    vec2<f32>(0.084, 0.15),
    vec2<f32>(0.084, 0.15),
    vec2<f32>(0.067, 0.12),
    vec2<f32>(0.067, 0.12),
    vec2<f32>(0.067, 0.12),
    vec2<f32>(0.067, 0.12)
);

const radii = array<f32, instanceCount>(
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.0,
    0.01,
    0.01,
    0.01,
    0.01,
    0.01,
    0.01,
    0.01,
    0.01,
    0.0,
    0.0,
    0.01,
    0.076,
    0.076,
    0.076,
    0.076,
    0.061,
    0.061,
    0.061,
    0.061,
    );

   const positions = array<vec2<f32>, instanceCount>(
        vec2<f32>(0, 0),
        vec2<f32>(-0.7, -0.5),
        vec2<f32>(-0.7, -0.3),
        vec2<f32>(-0.7, -0.1),
        vec2<f32>(-0.7, 0.1),
        vec2<f32>(-0.7, 0.3),
        vec2<f32>(-0.7, 0.5),
        vec2<f32>(0.7, -0.5),
        vec2<f32>(0.7, -0.3),
        vec2<f32>(0.7, -0.1),
        vec2<f32>(0.7, 0.1),
        vec2<f32>(0.7, 0.3),
        vec2<f32>(0.7, 0.5),
        vec2<f32>(0.982, 0.7), // vertical corner lines
        vec2<f32>(0.982, -0.7),
        vec2<f32>(-0.982, 0.7),
        vec2<f32>(-0.982, -0.7),
        vec2<f32>(0.832, 0.967), // horizontal corner lines
        vec2<f32>(0.832, -0.967),
        vec2<f32>(-0.832, 0.967),
        vec2<f32>(-0.832, -0.967),
        vec2<f32>(0, -0.4),
        vec2<f32>(0, -0.6),
        vec2<f32>(0, -0.5),
        vec2<f32>(-0.3, 0.5), // circles
        vec2<f32>(-0.1, 0.5),
        vec2<f32>(0.1, 0.5),
        vec2<f32>(0.3, 0.5),
        vec2<f32>(-0.3, 0.5),
        vec2<f32>(-0.1, 0.5),
        vec2<f32>(0.1, 0.5),
        vec2<f32>(0.3, 0.5)
    );