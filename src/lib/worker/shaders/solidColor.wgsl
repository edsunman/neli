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
    let instance_pos = baseTriangles[input.VertexIndex] * scales[input.InstanceIndex] + position;

    out.Position = vec4<f32>(instance_pos, 0.0, 1.0);
    out.color = vec4<f32>(colors[input.InstanceIndex], 1.0);
    out.localPosition = baseTriangles[input.VertexIndex];
    out.instanceScale = scales[input.InstanceIndex];

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
    let borderRadius = 0.015; 
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

const instanceCount: u32 = 8;

const positions = array<vec2<f32>, instanceCount>(
  vec2<f32>(0, 0),
  vec2<f32>(-0.15, 0),
  vec2<f32>(-0.1, 0),
  vec2<f32>(-0.05, 0),
  vec2<f32>(-0, 0),
  vec2<f32>(0.05, 0),
  vec2<f32>(0.1, 0),
  vec2<f32>(0.15, 0),
);

const scales = array<vec2<f32>, instanceCount>(
  vec2<f32>(1, 1),
  vec2<f32>(0.015, 0.06),
  vec2<f32>(0.015, 0.15),
  vec2<f32>(0.015, 0.33),
  vec2<f32>(0.015, 0.2),
  vec2<f32>(0.015, 0.1),
  vec2<f32>(0.015, 0.2),
  vec2<f32>(0.015, 0.06),
);

const colors = array<vec3<f32>, instanceCount>(
  vec3<f32>(0.0941, 0.0941, 0.1059),
  vec3<f32>(0.25490196, 0.25490196, 0.2745098),
  vec3<f32>(0.25490196, 0.25490196, 0.2745098),
  vec3<f32>(0.25490196, 0.25490196, 0.2745098),
  vec3<f32>(0.25490196, 0.25490196, 0.2745098),
  vec3<f32>(0.25490196, 0.25490196, 0.2745098),
  vec3<f32>(0.25490196, 0.25490196, 0.2745098),
  vec3<f32>(0.25490196, 0.25490196, 0.2745098),
);

const baseTriangles = array<vec2<f32>, 6>(
    vec2<f32>( 1,  1),
    vec2<f32>( 1, -1),
    vec2<f32>(-1, -1),
    vec2<f32>( 1,  1),
    vec2<f32>(-1, -1),
    vec2<f32>(-1,  1)
);

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

