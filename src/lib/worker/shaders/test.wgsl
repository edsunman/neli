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

@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    var pos = array<vec2<f32>, 6>(
        vec2<f32>( 1,  1),
        vec2<f32>( 1, -1),
        vec2<f32>(-1, -1),
        vec2<f32>( 1,  1),
        vec2<f32>(-1, -1),
        vec2<f32>(-1,  1)
    );

    var colors = array<vec4<f32>, 5>(
        vec4<f32>(0.087, 0.087, 0.087, 1),
        vec4<f32>(1, 0, 0, 1),
        vec4<f32>(0, 1, 0, 1),
        vec4<f32>(0, 0, 1, 1),
        vec4<f32>(1, 1, 1, 1)
    );

    var positions = array<vec2<f32>, 5>(
        vec2<f32>(0, 0),
        vec2<f32>(0.2, 0.5),
        vec2<f32>(0, 0.5),
        vec2<f32>(-0.2, 0.5),
        vec2<f32>(0, -0.5)
    );

     var scales = array<vec2<f32>, 5>(
        vec2<f32>(1, 1),
        vec2<f32>(0.09, 0.16),
        vec2<f32>(0.09, 0.16),
        vec2<f32>(0.09, 0.16),
        vec2<f32>(0.02, 0.1)
    );

    positions[4].x = ((uniforms.frameNumber % 30) / 20) - 0.75;

    let instance_pos = pos[input.VertexIndex] * scales[input.InstanceIndex] + positions[input.InstanceIndex];
    let zoomed_pos = instance_pos * uniforms.scale + uniforms.position;


    out.Position = vec4<f32>(zoomed_pos, 0.0, 1.0);
    out.color = colors[input.InstanceIndex];
    return out;
}

@fragment
fn fragmentMain(@location(0) color: vec4<f32>,) -> @location(0) vec4<f32> {
    return color;
}

