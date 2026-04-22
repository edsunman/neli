@group(0) @binding(0) var<uniform> uniforms: ClipUniforms;
@group(0) @binding(1) var mySampler: sampler;
@group(0) @binding(2) var myTexture: texture_2d<f32>;

struct VertexOutput {
    @builtin(position) Position: vec4<f32>,
    @location(0) uv: vec2<f32>,
}

@vertex
fn vertexMain(@builtin(vertex_index) VertexIndex: u32) -> VertexOutput {
    return layoutUniforms(VertexIndex, uniforms);
}

@fragment
fn fragmentMain(@location(0) uv : vec2<f32>) -> @location(0) vec4<f32> {
    let rawColor = textureSampleBaseClampToEdge(myTexture, mySampler, uv);
    return colorAndCropUniforms(rawColor, uv, uniforms);
}