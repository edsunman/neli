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
};

const instanceCount: u32 = 23;

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var out: VertexOutput; 

    var positions = array<vec2<f32>, instanceCount>(
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
        vec2<f32>(0, -0.5),
        vec2<f32>(0, -0.5)
    );


    positions[22].x = ((uniforms.frameNumber % 30) / 30) - 0.5;

    let instance_pos = baseTriangles[input.VertexIndex] * scales[input.InstanceIndex] + positions[input.InstanceIndex];
    let zoomed_pos = instance_pos * uniforms.scale + uniforms.position;


    out.Position = vec4<f32>(zoomed_pos, 0.0, 1.0);
    out.color = colors[input.InstanceIndex];
    return out;
}

@fragment
fn fragmentMain(@location(0) color: vec4<f32>,) -> @location(0) vec4<f32> {
    return color;
}


const baseTriangles = array<vec2<f32>, 6>(
    vec2<f32>( 1,  1),
    vec2<f32>( 1, -1),
    vec2<f32>(-1, -1),
    vec2<f32>( 1,  1),
    vec2<f32>(-1, -1),
    vec2<f32>(-1,  1)
);

const colors = array<vec4<f32>, instanceCount>(
    vec4<f32>(0.08, 0.08, 0.08, 1), //bg
    vec4<f32>(0, 0, 1, 1), // blue
    vec4<f32>(1, 0, 0, 1), // red
    vec4<f32>(1, 0, 1, 1), // purple
    vec4<f32>(0, 1, 0, 1), // green
    vec4<f32>(0, 1, 1, 1), // cyan
    vec4<f32>(1, 1, 0, 1), // yellow
    vec4<f32>(0, 0, 0, 1), // black
    vec4<f32>(0.2, 0.2, 0.2, 1), 
    vec4<f32>(0.4, 0.4, 0.4, 1), 
    vec4<f32>(0.6, 0.6, 0.6, 1), 
    vec4<f32>(0.8, 0.8, 0.8, 1), 
    vec4<f32>(1, 1, 1, 1), // white
    vec4<f32>(0.2, 0.2, 0.2, 1), 
    vec4<f32>(0.2, 0.2, 0.2, 1), 
    vec4<f32>(0.2, 0.2, 0.2, 1), 
    vec4<f32>(0.2, 0.2, 0.2, 1), 
    vec4<f32>(0.2, 0.2, 0.2, 1), 
    vec4<f32>(0.2, 0.2, 0.2, 1), 
    vec4<f32>(0.2, 0.2, 0.2, 1), 
    vec4<f32>(0.2, 0.2, 0.2, 1), 
    vec4<f32>(0.5, 0.5, 0.5, 1),
    vec4<f32>(1, 1, 1, 1)
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
    vec2<f32>(0.003, 0.12),
    vec2<f32>(0.016, 0.08)
);