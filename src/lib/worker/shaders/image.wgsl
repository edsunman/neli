struct MyUniforms {
    myNumber: f32,
    scale: vec2f,
    position: vec2f
};

@group(0) @binding(0) var<uniform> uniforms: MyUniforms;
@group(0) @binding(1) var mySampler: sampler;
@group(0) @binding(2) var myTexture: texture_2d<f32>;

struct VertexOutput {
    @builtin(position) Position: vec4<f32>,
    @location(0) uv: vec2<f32>,
}

@vertex
fn vertexMain(@builtin(vertex_index) VertexIndex: u32) -> VertexOutput {
    var pos = array<vec2<f32>, 6>(
    vec2<f32>( 1.0,  1.0),
    vec2<f32>( 1.0, -1.0),
    vec2<f32>(-1.0, -1.0),
    vec2<f32>( 1.0,  1.0),
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(-1.0,  1.0)
    );

    var uv = array<vec2<f32>, 6>(
    vec2<f32>(1.0, 0.0),
    vec2<f32>(1.0, 1.0),
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(0.0, 1.0),
    vec2<f32>(0.0, 0.0)
    );

    var output: VertexOutput;
    

    let scaled_pos = pos[VertexIndex] * uniforms.scale;
    let translated_pos = scaled_pos + uniforms.position;

    output.Position = vec4<f32>(translated_pos, 0.0, 1.0);
    output.uv = uv[VertexIndex];
    return output;
}

@fragment
fn fragmentMain(@location(0) uv : vec2<f32>) -> @location(0) vec4<f32> {
    return textureSampleBaseClampToEdge(myTexture, mySampler, uv);
}