'use strict';
/* WebGL image layer: draws the image with translate / scale / rotate and a radial lens correction. */

const VERTEX_SRC = `
attribute vec2 a; varying vec2 v;
void main(){ v = a; gl_Position = vec4(a.x*2.-1., 1.-a.y*2., 0., 1.); }`;

// For every canvas pixel, find which source pixel it shows (inverse mapping).
const FRAGMENT_SRC = `
precision highp float;
uniform sampler2D u_tex;
uniform vec2 u_doc, u_img, u_pos, u_c;
uniform float u_scale, u_rot, u_k1, u_k2;
varying vec2 v;
void main(){
  vec2 p  = v * u_doc;
  vec2 ic = u_pos + u_img * 0.5 * u_scale;               // image centre on the canvas
  vec2 d  = p - ic;
  float c = cos(-u_rot), s = sin(-u_rot);
  d = vec2(c*d.x - s*d.y, s*d.x + c*d.y);                // undo rotation
  vec2 q  = d / u_scale + u_img * 0.5;                   // pixel in the corrected image
  vec2 lc = u_c * u_img;                                 // lens centre
  float R = 0.5 * length(u_img);
  vec2 n  = (q - lc) / R;
  float r2 = dot(n, n);
  float f  = 1.0 - u_k1*r2 - u_k2*r2*r2;                 // positive k straightens barrel (fisheye)
  vec2 uv  = (lc + n*f*R) / u_img;
  if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) { gl_FragColor = vec4(0.); return; }
  gl_FragColor = texture2D(u_tex, uv);
}`;
const UNIFORMS = ['u_tex', 'u_doc', 'u_img', 'u_pos', 'u_c', 'u_scale', 'u_rot', 'u_k1', 'u_k2'];

let gl, program, texture;
const uniform = {};

function compileShader(type, src) {
  const sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
  return sh;
}

function initGL() {
  gl = dom.gl.getContext('webgl', {premultipliedAlpha: true, preserveDrawingBuffer: true, alpha: true});
  if (!gl) { alert('WebGL is not available in this browser.'); return; }
  program = gl.createProgram();
  gl.attachShader(program, compileShader(gl.VERTEX_SHADER, VERTEX_SRC));
  gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SRC));
  gl.linkProgram(program); gl.useProgram(program);

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());           // full-screen quad, y down
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, 'a');
  gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  UNIFORMS.forEach(n => uniform[n] = gl.getUniformLocation(program, n));
  texture = gl.createTexture();
}

/** Upload a canvas/image as the image texture. Caller guarantees size <= MAX_TEXTURE_SIZE. */
function uploadTexture(src) {
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  for (const [p, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR],
                        [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, p, v);
}

function renderGL() {
  if (!gl) return;
  const {w, h} = S.doc, I = S.img, L = S.lens;
  if (dom.gl.width !== w || dom.gl.height !== h) { dom.gl.width = w; dom.gl.height = h; }
  gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  if (!I.el) return;

  gl.useProgram(program);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, texture); gl.uniform1i(uniform.u_tex, 0);
  gl.uniform2f(uniform.u_doc, w, h);
  gl.uniform2f(uniform.u_img, I.w, I.h);
  gl.uniform2f(uniform.u_pos, I.x, I.y);
  gl.uniform2f(uniform.u_c, L.cx, L.cy);
  gl.uniform1f(uniform.u_scale, I.scale);
  gl.uniform1f(uniform.u_rot, I.rot * Math.PI / 180);
  gl.uniform1f(uniform.u_k1, L.bypass ? 0 : L.k1);
  gl.uniform1f(uniform.u_k2, L.bypass ? 0 : L.k2);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}
