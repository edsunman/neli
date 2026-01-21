@vertex
fn vertexMain(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4f {
  // Hardcoded coordinates for a triangle in NDC (Normalized Device Coordinates)
  var pos = array<vec2f, 3>(
    vec2f(-1.0, -1.0), // Bottom Left
    vec2f( 3.0, -1.0), // Far Right (past the screen)
    vec2f(-1.0,  3.0)  // Far Top (past the screen)
  );

  return vec4f(pos[VertexIndex], 0.0, 1.0);
}

@fragment
fn fragmentMain() -> @location(0) vec4f {
  // Returns a solid Red color (Red, Green, Blue, Alpha)
  return vec4f(0.0941, 0.0941, 0.1059, 1.0);
}