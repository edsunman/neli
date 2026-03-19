struct ClipUniforms {
    frameNumber: f32,  
    rotation: f32,    
    size: vec2f,           
    
    scale: vec2f,        
    position: vec2f,     
    
    fontSize: f32,         
    lineSpacing: f32,     
    justify: f32,         
    opacity: f32,          
    
    sourceSize: vec2f,    
    roundCorners: f32,    
    exposure: f32,        
    
    crop: vec4f,          
    
    contrast: f32,        
    saturation: f32,       
    _unused_pad: vec2f,    
    
    color: vec3f,          
    _final_pad: f32,       
};

@group(0) @binding(0) var<uniform> uniforms: ClipUniforms;
@group(0) @binding(1) var mySampler: sampler;
@group(0) @binding(2) var myTexture: texture_external;

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


    
    var p = pos[VertexIndex];
    let pixelRatio = uniforms.sourceSize / uniforms.size;
    let finalScale = pixelRatio * uniforms.scale;
    p = p * finalScale;
   // p.y = p.y / 1.777;

   let canvasAspect = uniforms.size.x / uniforms.size.y;

    // Step A: "Square" the Y-coordinate relative to the canvas
    p.y = p.y / canvasAspect;

    // Step B: Rotate
    let angle = uniforms.rotation; 
    let s = sin(angle);
    let c = cos(angle);
    let rotated_p = vec2f(
        p.x * c - p.y * s,
        p.x * s + p.y * c
    );

    // Step C: "Un-square" the Y-coordinate back to screen space
    let unsquared_p = vec2f(rotated_p.x, rotated_p.y * canvasAspect);

    // 6. Final Translation
    let translated_pos = unsquared_p + uniforms.position;

    var output: VertexOutput;       
    output.Position = vec4<f32>(translated_pos, 0.0, 1.0);
    output.uv = uv[VertexIndex];
    return output;
}

@fragment
fn fragmentMain(@location(0) uv : vec2<f32>) -> @location(0) vec4<f32> {
    var rawColor = textureSampleBaseClampToEdge(myTexture, mySampler, uv);
    var color = srgbToLinear(rawColor.rgb);

    // Exposure
    color = color * exp2(uniforms.exposure);

    // Hilights
    color = highlightRollOff(color);

    // Saturation
    let luminance = dot(color, vec3f(0.2126, 0.7152, 0.0722));
    color = mix(vec3f(luminance), color, uniforms.saturation);

    // Contrast
    let pivot = 0.18;
    color = pivot * pow(max(color / pivot, vec3f(0.0)), vec3f(uniforms.contrast));

    let finalRGB = linearToSrgb(color);

    let videoAspect = uniforms.sourceSize.x / uniforms.sourceSize.y;
    let radiusUV = uniforms.roundCorners / (uniforms.sourceSize.x * uniforms.scale.x);
    let dist = calculateBoxDistance(uv, uniforms.crop, radiusUV, videoAspect);
    let edge_smoothness = fwidth(dist);
    let mask = 1.0 - smoothstep(-edge_smoothness, edge_smoothness, dist);


    return vec4f(finalRGB, rawColor.a * uniforms.opacity * mask);
}

fn srgbToLinear(rgb: vec3f) -> vec3f {
    return pow(rgb, vec3f(2.2));
}

fn linearToSrgb(rgb: vec3f) -> vec3f {
    return pow(rgb, vec3f(1.0 / 2.2));
}

fn highlightRollOff(color: vec3f) -> vec3f {
    let luma = dot(color, vec3f(0.2126, 0.7152, 0.0722));
    let knee = 0.5; // Start smoothing at 50% brightness

    if (luma <= knee) {
        return color;
    }
    let over = luma - knee;
    let compressedOver = sqrt(over); 
    
    // R-scale the compressed value so it stays in a visible range [0.5 to 1.0]
    let newLuma = knee + (compressedOver * 0.25); 

    return color * (newLuma / luma);
}

fn calculateBoxDistance(uv: vec2f, crop: vec4f, radius: f32, aspect: f32) -> f32 {
    let left = crop.x;
    let top = crop.y;
    let right = 1.0 - crop.z;
    let bottom = 1.0 - crop.w;

    let scaledUV = vec2f(uv.x, uv.y / aspect);
    
    let size = vec2f(right - left, (bottom - top) / aspect) * 0.5;
    let center = vec2f(left + (right - left) * 0.5, (top + (bottom - top) * 0.5) / aspect);
    
    let q = abs(scaledUV - center) - size + radius;
    // Return the raw distance value
    return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - radius;
}