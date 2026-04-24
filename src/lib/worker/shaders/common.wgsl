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

fn layoutUniforms(vertex_index: u32, u: ClipUniforms) -> VertexOutput {
    var pos = array<vec2f, 6>(
        vec2f( 1.0,  1.0), vec2f( 1.0, -1.0), vec2f(-1.0, -1.0),
        vec2f( 1.0,  1.0), vec2f(-1.0, -1.0), vec2f(-1.0,  1.0)
    );

    var uv = array<vec2f, 6>(
        vec2f(1.0, 0.0), vec2f(1.0, 1.0), vec2f(0.0, 1.0),
        vec2f(1.0, 0.0), vec2f(0.0, 1.0), vec2f(0.0, 0.0)
    );

    var p = pos[vertex_index];
    
    // 1. Calculate Scales
    let pixelRatio = u.sourceSize / u.size;
    let finalScale = pixelRatio * u.scale;
    p = p * finalScale;

    // 2. Handle Aspect Ratio for Rotation
    let canvasAspect = u.size.x / u.size.y;
    p.y = p.y / canvasAspect;

    // 3. Rotate
    let s = sin(u.rotation);
    let c = cos(u.rotation);
    let rotated_p = vec2f(
        p.x * c - p.y * s,
        p.x * s + p.y * c
    );

    // 4. Un-square and Translate
    let unsquared_p = vec2f(rotated_p.x, rotated_p.y * canvasAspect);
    let translated_pos = unsquared_p + u.position;

    var output: VertexOutput;
    output.Position = vec4f(translated_pos, 0.0, 1.0);
    output.uv = uv[vertex_index];
    return output;
}

fn colorAndCropUniforms(rawColor: vec4f, uv: vec2f, u: ClipUniforms) -> vec4f {
    var color = srgbToLinear(rawColor.rgb);

    // 1. Color Grading
    color = color * exp2(u.exposure);
    color = highlightRollOff(color, u.exposure);

    let luminance = dot(color, vec3f(0.2126, 0.7152, 0.0722));
    color = mix(vec3f(luminance), color, u.saturation);

    let pivot = 0.18;
    color = pivot * pow(max(color / pivot, vec3f(0.0)), vec3f(u.contrast));

    let finalRGB = linearToSrgb(color);

    // 2. Shape / Masking
    let aspect = u.sourceSize.x / u.sourceSize.y;
    // Calculate radius in UV space relative to the object's current scale
    let radiusUV = u.roundCorners / (u.sourceSize.x * u.scale.x);
    let dist = calculateBoxDistance(uv, u.crop, radiusUV, aspect);
    
    let edge_smoothness = fwidth(dist);
    let mask = 1.0 - smoothstep(-edge_smoothness, edge_smoothness, dist);

    return vec4f(finalRGB, rawColor.a * u.opacity * mask);
}

fn srgbToLinear(rgb: vec3f) -> vec3f {
    return pow(rgb, vec3f(2.2));
}

fn linearToSrgb(rgb: vec3f) -> vec3f {
    return pow(rgb, vec3f(1.0 / 2.2));
}

fn highlightRollOff(color: vec3f, exposure: f32) -> vec3f {
    let luma = dot(color, vec3f(0.2126, 0.7152, 0.0722));
    let knee = mix(1.0, 0.5, saturate(exposure / 3.0)); 

    if (luma <= knee) {
        return color;
    }

    let range = 1.0 - knee;
    let newLuma = knee + range * (luma - knee) / (range + luma - knee);

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