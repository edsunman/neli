struct FontCharacter {
  texOffset: vec2f,
  texExtent: vec2f,
  size: vec2f,
  offset: vec2f,
};

struct CharData {
  position: vec2f,       // index 0, 1
  index: f32,   // index 2 (Option A: Use f32 and cast to u32 in shader)
  opacity: f32,     // index 3
  crop: f32,    // index 4
  _pad: f32,        // index 5 (Force size to 24 bytes)
};

struct FormattedText {
  color: vec4f,     // indices 0, 1, 2, 3
  scale: f32,       // index 4
  _pad1: f32,       // index 5
  _pad2: f32,       // index 6
  _pad3: f32,       // index 7
  chars: array<CharData>, 
};

struct ClipUniforms {
    frameNumber: f32,
    scale: vec2f,
    position: vec2f
};

// Font bindings
@group(0) @binding(0) var fontTexture: texture_2d<f32>;
@group(0) @binding(1) var fontSampler: sampler;
@group(0) @binding(2) var<storage> fontCharacters: array<FontCharacter>;

// Text bindings
@group(1) @binding(0) var<uniform> clip: ClipUniforms;
@group(1) @binding(1) var<storage> text: FormattedText;

struct VertexInput {
  @builtin(vertex_index) vertex : u32,
  @builtin(instance_index) instance : u32,
};

struct VertexOutput {
  @builtin(position) position : vec4f,
  @location(0) texcoord : vec2f,
  @location(1) charOpacity: f32, 
  @location(2) charCrop: f32, 
  @location(3) charPos : vec2f,
};

@vertex
fn vertexMain(input : VertexInput) -> VertexOutput {
    let character = text.chars[input.instance];
    let index = u32(character.index);
    let fontCharacter = fontCharacters[index];

    let charPos = (quad[input.vertex] * fontCharacter.size + character.position) * text.scale;

    // Adjust for aspect ratio
    let scale = vec2f(clip.scale.x * 0.562, clip.scale.y);
    let newCharPos = charPos * scale + clip.position;

    var output : VertexOutput;
    output.position = vec4f(newCharPos, 0, 1);
    output.charPos = quad[input.vertex] * vec2f(1, -1);
    output.texcoord = quad[input.vertex] * vec2f(1, -1);
    output.texcoord *= fontCharacter.texExtent;
    output.texcoord += fontCharacter.texOffset;
    output.charOpacity = character.opacity;
    output.charCrop = character.crop;
    return output;
}

// Antialiasing technique from Paul Houx 
// https://github.com/Chlumsky/msdfgen/issues/22#issuecomment-234958005
@fragment
fn fragmentMain(input : VertexOutput) -> @location(0) vec4f {
    if (input.charPos.y > input.charCrop) {
      discard;
    }
    // pxRange (AKA distanceRange) comes from the msdfgen tool. Don McCurdy's tool
    // uses the default which is 4.
    let pxRange = 3.0;
    let sz = vec2f(textureDimensions(fontTexture, 0));
    let dx = sz.x*length(vec2f(dpdxFine(input.texcoord.x), dpdyFine(input.texcoord.x)));
    let dy = sz.y*length(vec2f(dpdxFine(input.texcoord.y), dpdyFine(input.texcoord.y)));
    let toPixels = pxRange * inverseSqrt(dx * dx + dy * dy);
    let sigDist = sampleMsdf(input.texcoord) - 0.5;
    let pxDist = sigDist * toPixels;

    let edgeWidth = 0.5;

    let alpha = smoothstep(-edgeWidth, edgeWidth, pxDist);

    if (alpha < 0.001) { 
        discard;
    }

    return vec4f(text.color.rgb,  text.color.a * alpha * input.charOpacity );
}


// Positions for simple quad geometry
const quad = array(vec2f(0, -1), vec2f(1, -1), vec2f(0, 0), vec2f(1, 0));

fn sampleMsdf(texcoord: vec2f) -> f32 {
    let c = textureSample(fontTexture, fontSampler, texcoord);
    return max(min(c.r, c.g), min(max(c.r, c.g), c.b));
}