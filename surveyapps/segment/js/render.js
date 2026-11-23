'use strict';
/* render.js — High-performance cell renderer (WebGL point sprites with automatic
 * Canvas 2D ImageData Uint32 pixel-splat fallback), viewport-culled well grid &
 * ROI polygon overlay (plus offscreen pixel map for huge zoomed-out grids),
 * brush cursor preview, optional background tissue image, and pan/zoom math. */

const GL_VERT_SRC = `
attribute vec2 a_pos;
attribute vec4 a_color;
uniform vec2 u_center;
uniform vec2 u_viewport;
uniform float u_scale;
uniform float u_ySign;
uniform float u_pointSize;
varying vec4 v_color;
void main() {
  vec2 screen = (a_pos - u_center) * vec2(u_scale, u_scale * u_ySign) + u_viewport * 0.5;
  vec2 ndc = (screen / u_viewport) * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
  gl_PointSize = u_pointSize;
  v_color = a_color;
}
`;

const GL_FRAG_SRC = `
precision mediump float;
uniform float u_alpha;
varying vec4 v_color;
void main() {
  vec2 d = gl_PointCoord - vec2(0.5);
  float r2 = dot(d, d);
  if (r2 > 0.25) discard;
  float edge = 1.0 - smoothstep(0.18, 0.25, r2);
  float a = v_color.a * u_alpha * edge;
  gl_FragColor = vec4(v_color.rgb * a, a);
}
`;

const glState = {
  gl: null,
  prog: null,
  posBuf: null,
  colBuf: null,
  loc: {},
  posCount: 0,
  colCount: 0,
  uploadedChip: '',
  uploadedPosVersion: 0,
  uploadedColVersion: 0,
  posVersion: 0,
  colVersion: 0,
};

let cpuImageData = null;
let cpuU32 = null;

function forceCpuQuery() {
  try { return new URLSearchParams(location.search).get('renderer') === 'cpu'; } catch { return false; }
}

function initCellRenderer() {
  if (forceCpuQuery()) {
    enterCpuRenderer();
    return;
  }
  const canvas = dom.cellCanvas;
  if (!canvas) return;
  let gl = null;
  try {
    gl = canvas.getContext('webgl2', { alpha: true, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: true })
      || canvas.getContext('webgl', { alpha: true, antialias: false, premultipliedAlpha: true, preserveDrawingBuffer: true });
  } catch { gl = null; }
  if (!gl) {
    enterCpuRenderer();
    return;
  }
  const compile = (type, src) => {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  };
  const vs = compile(gl.VERTEX_SHADER, GL_VERT_SRC);
  const fs = compile(gl.FRAGMENT_SHADER, GL_FRAG_SRC);
  if (!vs || !fs) { enterCpuRenderer(); return; }
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    enterCpuRenderer();
    return;
  }

  glState.gl = gl;
  glState.prog = prog;
  glState.posBuf = gl.createBuffer();
  glState.colBuf = gl.createBuffer();
  glState.loc = {
    a_pos: gl.getAttribLocation(prog, 'a_pos'),
    a_color: gl.getAttribLocation(prog, 'a_color'),
    u_center: gl.getUniformLocation(prog, 'u_center'),
    u_viewport: gl.getUniformLocation(prog, 'u_viewport'),
    u_scale: gl.getUniformLocation(prog, 'u_scale'),
    u_ySign: gl.getUniformLocation(prog, 'u_ySign'),
    u_pointSize: gl.getUniformLocation(prog, 'u_pointSize'),
    u_alpha: gl.getUniformLocation(prog, 'u_alpha'),
  };
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  S.renderer = 'webgl';

  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    enterCpuRenderer();
    dirty('cells', 'status');
  });
}

function enterCpuRenderer() {
  glState.gl = null;
  glState.prog = null;
  if (dom.cellCanvas && dom.cellCanvas.parentNode) {
    // A canvas that previously held a WebGL context cannot return a 2D context — replace it cleanly.
    const fresh = document.createElement('canvas');
    fresh.id = 'cellCanvas';
    fresh.className = dom.cellCanvas.className;
    dom.cellCanvas.parentNode.replaceChild(fresh, dom.cellCanvas);
    dom.cellCanvas = fresh;
  }
  cpuImageData = null;
  cpuU32 = null;
  S.renderer = 'cpu';
}

/* ---- Coordinate transforms ---- */
function ySign() { return S.display.yInvert ? 1 : -1; }

function dataToScreen(x, y) {
  return {
    x: (x - S.view.cx) * S.view.scale + S.view.cssW * 0.5,
    y: (y - S.view.cy) * S.view.scale * ySign() + S.view.cssH * 0.5,
  };
}

function screenToData(sx, sy) {
  return {
    x: (sx - S.view.cssW * 0.5) / S.view.scale + S.view.cx,
    y: (sy - S.view.cssH * 0.5) / (S.view.scale * ySign()) + S.view.cy,
  };
}

function fitViewToWells(cs = activeChipState()) {
  if (!cs || !cs.wells) return;
  const w = cs.wells;
  const spanX = Math.max(1e-3, w.maxX - w.minX);
  const spanY = Math.max(1e-3, w.maxY - w.minY);
  const pad = 0.90;
  const cssW = Math.max(100, S.view.cssW);
  const cssH = Math.max(100, S.view.cssH);
  S.view.cx = (w.minX + w.maxX) * 0.5;
  S.view.cy = (w.minY + w.maxY) * 0.5;
  S.view.scale = Math.min((cssW * pad) / spanX, (cssH * pad) / spanY);
}

function zoomAtScreen(sx, sy, factor) {
  const cs = activeChipState();
  if (!cs) return;
  const before = screenToData(sx, sy);
  const span = Math.max(1e-3, cs.wells.maxX - cs.wells.minX, cs.wells.maxY - cs.wells.minY);
  const minScale = Math.min(S.view.cssW, S.view.cssH) * 0.15 / span;
  const maxScale = Math.max(S.view.cssW, S.view.cssH) * 200 / span;
  S.view.scale = clamp(S.view.scale * factor, minScale, maxScale);
  const after = screenToData(sx, sy);
  S.view.cx += before.x - after.x;
  S.view.cy += before.y - after.y;
}

/* ---- Fast Cell Color Computation (handles 1,000,000 cells in ~5-10 ms) ---- */
function resolveCategoryColors(colName, categories, counts) {
  const colOverrides = (S.meta.colorsByCol && S.meta.colorsByCol[colName]) || {};
  const flatOverrides = S.meta.flatColors || {};
  // Sort categories by frequency descending (matches survey/singlecell/meta.py add_colors by_size=True)
  const order = categories.map((_, i) => i).sort((a, b) => (counts ? counts[b] - counts[a] : 0) || a - b);
  const hexByIdx = new Array(categories.length);
  const pal = getDefaultPalette(categories.length);
  let palCursor = 0;

  for (let o = 0; o < order.length; o++) {
    const idx = order[o];
    const label = categories[idx];
    const ov = colOverrides[label] || flatOverrides[label];
    if (ov) {
      hexByIdx[idx] = normalizeHexColor(ov, pal[palCursor % pal.length]);
    } else {
      hexByIdx[idx] = pal[palCursor % pal.length];
      palCursor++;
    }
  }
  return { hexByIdx, order };
}

function computeCellColors() {
  const cs = activeChipState();
  const cellIndices = activeChipCells();
  if (!cs || !cellIndices) {
    S.cellColors.rgba = null;
    S.cellColors.legend = null;
    return;
  }
  const n = cellIndices.length;
  const colIdx = S.data.colMap.color;
  const col = colIdx >= 0 ? S.data.columns[colIdx] : null;
  const cc = S.cellColors;

  if (
    cc.rgba && cc.rgba.length === n * 4 &&
    cc.chip === S.chips.active &&
    cc.colIdx === colIdx &&
    cc.colormap === S.display.colormap &&
    cc.clip === S.display.clipPercentile &&
    cc.log === S.display.logScale &&
    cc.metaRev === S.metaRev
  ) {
    return; // Already up to date
  }

  const rgba = (cc.rgba && cc.rgba.length === n * 4) ? cc.rgba : new Uint8Array(n * 4);
  let legend = { kind: 'none', colName: '' };

  if (!col) {
    // Uniform default cyan-slate tint when no covariate column is selected
    for (let i = 0; i < n; i++) {
      const k = i * 4;
      rgba[k] = 148; rgba[k + 1] = 198; rgba[k + 2] = 224; rgba[k + 3] = 255;
    }
  } else if (col.kind === 'category') {
    // Compute chip-specific counts for legend & frequency ordering
    const nCats = col.categories.length;
    const chipCounts = new Uint32Array(nCats);
    const codes = col.codes;
    for (let i = 0; i < n; i++) {
      const c = codes[cellIndices[i]];
      if (c > 0) chipCounts[c - 1]++;
    }
    const { hexByIdx, order } = resolveCategoryColors(col.name, col.categories, chipCounts);
    const lut = new Uint8Array((nCats + 1) * 4);
    lut[0] = 96; lut[1] = 108; lut[2] = 122; lut[3] = 160; // missing
    for (let c = 0; c < nCats; c++) {
      const rgb = parseColorToRgb(hexByIdx[c]) || [148, 198, 224];
      const o = (c + 1) * 4;
      lut[o] = rgb[0]; lut[o + 1] = rgb[1]; lut[o + 2] = rgb[2]; lut[o + 3] = 255;
    }
    for (let i = 0; i < n; i++) {
      const o = codes[cellIndices[i]] * 4;
      const k = i * 4;
      rgba[k] = lut[o]; rgba[k + 1] = lut[o + 1]; rgba[k + 2] = lut[o + 2]; rgba[k + 3] = lut[o + 3];
    }
    const items = [];
    for (let j = 0; j < order.length; j++) {
      const idx = order[j];
      if (chipCounts[idx] > 0) {
        items.push({ label: col.categories[idx], color: hexByIdx[idx], count: chipCounts[idx] });
      }
    }
    legend = { kind: 'category', colName: col.name, items };
  } else if (col.kind === 'number') {
    const lut = COLORMAP_LUTS[S.display.colormap] || COLORMAP_LUTS.viridis;
    const num = col.num;
    const useLog = S.display.logScale;
    let lo = (S.display.clipPercentile && col.p99 > col.p01) ? col.p01 : col.min;
    let hi = (S.display.clipPercentile && col.p99 > col.p01) ? col.p99 : col.max;
    if (!(hi > lo)) hi = lo + 1;

    const logOffset = lo < 0 ? -lo : 0;
    const loT = useLog ? Math.log1p(Math.max(0, lo + logOffset)) : lo;
    const hiT = useLog ? Math.log1p(Math.max(0, hi + logOffset)) : hi;
    const invSpan = hiT > loT ? 255 / (hiT - loT) : 0;

    for (let i = 0; i < n; i++) {
      const v = num[cellIndices[i]];
      const k = i * 4;
      if (Number.isNaN(v)) {
        rgba[k] = 96; rgba[k + 1] = 108; rgba[k + 2] = 122; rgba[k + 3] = 140;
      } else {
        const vt = useLog ? Math.log1p(Math.max(0, v + logOffset)) : v;
        let idx = ((vt - loT) * invSpan) | 0;
        if (idx < 0) idx = 0; else if (idx > 255) idx = 255;
        const o = idx * 3;
        rgba[k] = lut[o]; rgba[k + 1] = lut[o + 1]; rgba[k + 2] = lut[o + 2]; rgba[k + 3] = 255;
      }
    }
    legend = { kind: 'number', colName: col.name, min: lo, max: hi, colormap: S.display.colormap, log: useLog };
  } else {
    // High-cardinality string column fallback
    for (let i = 0; i < n; i++) {
      const k = i * 4;
      rgba[k] = 148; rgba[k + 1] = 198; rgba[k + 2] = 224; rgba[k + 3] = 255;
    }
    legend = { kind: 'none', colName: col.name };
  }

  cc.chip = S.chips.active;
  cc.colIdx = colIdx;
  cc.colormap = S.display.colormap;
  cc.clip = S.display.clipPercentile;
  cc.log = S.display.logScale;
  cc.metaRev = S.metaRev;
  cc.rgba = rgba;
  cc.legend = legend;
  glState.colVersion++;
}

function markPositionsDirty() {
  glState.posVersion++;
  glState.uploadedChip = '';
}

function syncCanvasSizes() {
  const stage = dom.stage;
  if (!stage) return;
  const rect = stage.getBoundingClientRect();
  const cssW = Math.max(1, Math.floor(rect.width));
  const cssH = Math.max(1, Math.floor(rect.height));
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const pxW = Math.max(1, Math.round(cssW * dpr));
  const pxH = Math.max(1, Math.round(cssH * dpr));
  const changed = cssW !== S.view.cssW || cssH !== S.view.cssH || dpr !== S.view.dpr;
  S.view.cssW = cssW;
  S.view.cssH = cssH;
  S.view.dpr = dpr;

  const canvases = [dom.bgCanvas, dom.cellCanvas, dom.overlayCanvas, dom.cursorCanvas];
  for (let i = 0; i < canvases.length; i++) {
    const c = canvases[i];
    if (!c) continue;
    if (c.width !== pxW || c.height !== pxH) {
      c.width = pxW;
      c.height = pxH;
      c.style.width = cssW + 'px';
      c.style.height = cssH + 'px';
    }
  }
  if (changed) {
    cpuImageData = null;
    cpuU32 = null;
  }
  return changed;
}

function uploadCellPositionsGL(cs) {
  const gl = glState.gl;
  if (!gl || !cs) return;
  const xs = cs.wells.xs, ys = cs.wells.ys;
  const n = xs.length;
  const packed = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    packed[i * 2] = xs[i];
    packed[i * 2 + 1] = ys[i];
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, glState.posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, packed, gl.STATIC_DRAW);
  glState.posCount = n;
  glState.uploadedChip = S.chips.active;
  glState.uploadedPosVersion = glState.posVersion;
}

function uploadCellColorsGL() {
  const gl = glState.gl;
  if (!gl || !S.cellColors.rgba) return;
  gl.bindBuffer(gl.ARRAY_BUFFER, glState.colBuf);
  gl.bufferData(gl.ARRAY_BUFFER, S.cellColors.rgba, gl.STATIC_DRAW);
  glState.colCount = S.cellColors.rgba.length >>> 2;
  glState.uploadedColVersion = glState.colVersion;
}

function renderCells() {
  const cs = activeChipState();
  const canvas = dom.cellCanvas;
  if (!canvas) return;
  const pxW = canvas.width, pxH = canvas.height;

  if (S.renderer === 'webgl' && glState.gl) {
    const gl = glState.gl;
    gl.viewport(0, 0, pxW, pxH);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    if (!cs || !S.display.showCells || cs.wells.xs.length === 0) return;

    if (glState.uploadedChip !== S.chips.active || glState.uploadedPosVersion !== glState.posVersion) {
      uploadCellPositionsGL(cs);
    }
    if (glState.uploadedColVersion !== glState.colVersion || glState.colCount !== glState.posCount) {
      uploadCellColorsGL();
    }
    if (glState.posCount === 0) return;

    const loc = glState.loc;
    gl.useProgram(glState.prog);
    gl.uniform2f(loc.u_center, S.view.cx, S.view.cy);
    gl.uniform2f(loc.u_viewport, S.view.cssW, S.view.cssH);
    gl.uniform1f(loc.u_scale, S.view.scale);
    gl.uniform1f(loc.u_ySign, ySign());
    gl.uniform1f(loc.u_pointSize, clamp(S.display.cellSize * S.view.dpr, 1, 64));
    gl.uniform1f(loc.u_alpha, S.display.cellAlpha);

    gl.bindBuffer(gl.ARRAY_BUFFER, glState.posBuf);
    gl.enableVertexAttribArray(loc.a_pos);
    gl.vertexAttribPointer(loc.a_pos, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, glState.colBuf);
    gl.enableVertexAttribArray(loc.a_color);
    gl.vertexAttribPointer(loc.a_color, 4, gl.UNSIGNED_BYTE, true, 0, 0);

    gl.drawArrays(gl.POINTS, 0, glState.posCount);
    return;
  }

  // Software fallback: direct Uint32Array pixel splatting into ImageData (1M cells in ~15-25 ms!)
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, pxW, pxH);
  if (!cs || !S.display.showCells || !S.cellColors.rgba || cs.wells.xs.length === 0) return;

  if (!cpuImageData || cpuImageData.width !== pxW || cpuImageData.height !== pxH) {
    cpuImageData = ctx.createImageData(pxW, pxH);
    cpuU32 = new Uint32Array(cpuImageData.data.buffer);
  }
  cpuU32.fill(0);

  const xs = cs.wells.xs, ys = cs.wells.ys, rgba = S.cellColors.rgba;
  const n = xs.length;
  const dpr = S.view.dpr;
  const scaleX = S.view.scale * dpr;
  const scaleY = S.view.scale * ySign() * dpr;
  const cx = S.view.cx, cy = S.view.cy;
  const halfW = pxW * 0.5, halfH = pxH * 0.5;
  const alphaByte = clamp(Math.round(S.display.cellAlpha * 255), 0, 255);
  const rad = Math.max(0, Math.floor((S.display.cellSize * dpr - 1) * 0.5));
  const rad2 = (rad + 0.4) * (rad + 0.4);

  if (rad === 0) {
    for (let i = 0; i < n; i++) {
      const sx = ((xs[i] - cx) * scaleX + halfW) | 0;
      const sy = ((ys[i] - cy) * scaleY + halfH) | 0;
      if (sx < 0 || sx >= pxW || sy < 0 || sy >= pxH) continue;
      const k = i * 4;
      const a = (rgba[k + 3] * alphaByte) >> 8;
      cpuU32[sy * pxW + sx] = (a << 24) | (rgba[k + 2] << 16) | (rgba[k + 1] << 8) | rgba[k];
    }
  } else {
    // Precompute circular pixel offsets for fast splat
    const offs = [];
    for (let dy = -rad; dy <= rad; dy++) {
      for (let dx = -rad; dx <= rad; dx++) {
        if (dx * dx + dy * dy <= rad2) offs.push(dx, dy);
      }
    }
    const oLen = offs.length;
    for (let i = 0; i < n; i++) {
      const sx = ((xs[i] - cx) * scaleX + halfW) | 0;
      const sy = ((ys[i] - cy) * scaleY + halfH) | 0;
      if (sx < -rad || sx >= pxW + rad || sy < -rad || sy >= pxH + rad) continue;
      const k = i * 4;
      const a = (rgba[k + 3] * alphaByte) >> 8;
      const col32 = (a << 24) | (rgba[k + 2] << 16) | (rgba[k + 1] << 8) | rgba[k];
      for (let o = 0; o < oLen; o += 2) {
        const px = sx + offs[o], py = sy + offs[o + 1];
        if (px >= 0 && px < pxW && py >= 0 && py < pxH) cpuU32[py * pxW + px] = col32;
      }
    }
  }
  ctx.putImageData(cpuImageData, 0, 0);
}

/* ---- Background Tissue Image Layer ---- */
function renderBgImage() {
  const canvas = dom.bgCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const img = S.display.bgImage;
  const cs = activeChipState();
  if (!img || !cs) return;

  const w = cs.wells;
  const p1 = dataToScreen(w.minX, w.maxY);
  const p2 = dataToScreen(w.maxX, w.minY);
  const left = Math.min(p1.x, p2.x);
  const top = Math.min(p1.y, p2.y);
  const rw = Math.abs(p2.x - p1.x);
  const rh = Math.abs(p2.y - p1.y);
  ctx.setTransform(S.view.dpr, 0, 0, S.view.dpr, 0, 0);
  ctx.globalAlpha = S.display.bgAlpha;
  ctx.drawImage(img, left, top, rw, rh);
  ctx.globalAlpha = 1;
}

/* ---- Offscreen 1-pixel-per-well ROI map for ultra-fast zoomed-out rendering ---- */
function ensureRoiMapCanvas(cs) {
  const w = cs.wells;
  if (!cs.roiMapCanvas || cs.roiMapCanvas.width !== w.nCols || cs.roiMapCanvas.height !== w.nRows) {
    cs.roiMapCanvas = document.createElement('canvas');
    cs.roiMapCanvas.width = w.nCols;
    cs.roiMapCanvas.height = w.nRows;
    cs.roiMapDirty = true;
  }
  if (!cs.roiMapDirty) return cs.roiMapCanvas;
  const ctx = cs.roiMapCanvas.getContext('2d');
  const img = ctx.createImageData(w.nCols, w.nRows);
  const u32 = new Uint32Array(img.data.buffer);
  const g2w = w.gridToWell, wellRoi = cs.wellRoi, roiById = cs.roiById;
  for (let g = 0; g < g2w.length; g++) {
    const wIdx = g2w[g];
    if (wIdx < 0) continue;
    const rid = wellRoi[wIdx];
    if (rid > 0) {
      const roi = roiById.get(rid);
      if (roi) u32[g] = (255 << 24) | (roi.rgb[2] << 16) | (roi.rgb[1] << 8) | roi.rgb[0];
    }
  }
  ctx.putImageData(img, 0, 0);
  cs.roiMapDirty = false;
  return cs.roiMapCanvas;
}

/* ---- Well Grid Borders & ROI Overlay Layer ---- */
function renderOverlay() {
  const canvas = dom.overlayCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const cs = activeChipState();
  if (!cs) return;
  const w = cs.wells;
  const dpr = S.view.dpr;
  const scale = S.view.scale;
  const ys = ySign();
  const cxView = S.view.cx, cyView = S.view.cy;
  const halfCssW = S.view.cssW * 0.5, halfCssH = S.view.cssH * 0.5;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // Compute visible data bounding box for viewport culling
  const visHalfW = halfCssW / scale + w.pitchX * 2;
  const visHalfH = halfCssH / scale + w.pitchY * 2;
  const visMinX = cxView - visHalfW, visMaxX = cxView + visHalfW;
  const visMinY = cyView - visHalfH, visMaxY = cyView + visHalfH;

  const wellPx = Math.min(w.pitchX, w.pitchY) * scale;

  // 1. Draw colored ROI overlay
  if (S.display.showRois && S.display.roiAlpha > 0 && cs.rois.length > 0) {
    ctx.globalAlpha = S.display.roiAlpha;
    const usePixelBlit = w.shape === 'square' && w.mode === 'derived' && wellPx < 5.5;
    if (usePixelBlit) {
      const mapCanvas = ensureRoiMapCanvas(cs);
      const topLeft = dataToScreen(w.minX, w.maxY);
      const botRight = dataToScreen(w.maxX, w.minY);
      ctx.imageSmoothingEnabled = false;
      ctx.save();
      if (S.display.yInvert) {
        // When Y is flipped, row 0 (maxY) sits at topLeft.y (bottom) and row nRows-1 (minY) at botRight.y (top)
        ctx.translate(topLeft.x, topLeft.y);
        ctx.scale(1, -1);
        ctx.drawImage(mapCanvas, 0, 0, botRight.x - topLeft.x, topLeft.y - botRight.y);
      } else {
        ctx.drawImage(mapCanvas, topLeft.x, topLeft.y, botRight.x - topLeft.x, botRight.y - topLeft.y);
      }
      ctx.restore();
    } else {
      // Group visible painted wells by ROI ID for single batched fill() per ROI!
      const buckets = new Map();
      const wellRoi = cs.wellRoi, wcx = w.cx, wcy = w.cy;
      for (let i = 0; i < w.count; i++) {
        const rid = wellRoi[i];
        if (rid === 0) continue;
        const x = wcx[i], y = wcy[i];
        if (x < visMinX || x > visMaxX || y < visMinY || y > visMaxY) continue;
        let list = buckets.get(rid);
        if (!list) { list = []; buckets.set(rid, list); }
        list.push(i);
      }
      const hwPx = w.halfW * scale, hhPx = w.halfH * scale;
      const rwPx = hwPx * 2, rhPx = hhPx * 2;
      for (const [rid, idxs] of buckets.entries()) {
        const roi = cs.roiById.get(rid);
        if (!roi) continue;
        ctx.fillStyle = roi.color;
        ctx.beginPath();
        if (w.shape === 'hex' && w.verts) {
          const verts = w.verts;
          for (let j = 0; j < idxs.length; j++) {
            const off = idxs[j] * 12;
            ctx.moveTo((verts[off] - cxView) * scale + halfCssW, (verts[off + 1] - cyView) * scale * ys + halfCssH);
            for (let k = 1; k < 6; k++) {
              ctx.lineTo((verts[off + k * 2] - cxView) * scale + halfCssW, (verts[off + k * 2 + 1] - cyView) * scale * ys + halfCssH);
            }
            ctx.closePath();
          }
        } else {
          for (let j = 0; j < idxs.length; j++) {
            const idx = idxs[j];
            const sx = (wcx[idx] - cxView) * scale + halfCssW - hwPx;
            const sy = (wcy[idx] - cyView) * scale * ys + halfCssH - hhPx;
            ctx.rect(sx, sy, rwPx, rhPx);
          }
        }
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // 2. Draw subtle well borders (matching segment.py borders=(0,1,0,0.2), styled cleanly for dark UI)
  if (S.display.showBorders && wellPx >= 3.2) {
    ctx.strokeStyle = wellPx >= 10 ? 'rgba(135, 229, 250, 0.22)' : 'rgba(135, 229, 250, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (w.mode === 'derived' && w.shape === 'square' && wellPx < 14) {
      // Ultra-fast regular grid lines when zoomed out
      const pMin = dataToScreen(w.minX, w.maxY);
      const pMax = dataToScreen(w.maxX, w.minY);
      const x0 = Math.min(pMin.x, pMax.x), x1 = Math.max(pMin.x, pMax.x);
      const y0 = Math.min(pMin.y, pMax.y), y1 = Math.max(pMin.y, pMax.y);
      const stepX = w.pitchX * scale, stepY = w.pitchY * scale;
      for (let c = 0; c <= w.nCols; c++) {
        const x = Math.round(x0 + c * stepX) + 0.5;
        if (x >= -1 && x <= S.view.cssW + 1) { ctx.moveTo(x, y0); ctx.lineTo(x, y1); }
      }
      for (let r = 0; r <= w.nRows; r++) {
        const y = Math.round(y0 + r * stepY) + 0.5;
        if (y >= -1 && y <= S.view.cssH + 1) { ctx.moveTo(x0, y); ctx.lineTo(x1, y); }
      }
    } else if (w.shape === 'hex' && w.verts) {
      const verts = w.verts, wcx = w.cx, wcy = w.cy;
      for (let i = 0; i < w.count; i++) {
        if (wcx[i] < visMinX || wcx[i] > visMaxX || wcy[i] < visMinY || wcy[i] > visMaxY) continue;
        const off = i * 12;
        ctx.moveTo((verts[off] - cxView) * scale + halfCssW, (verts[off + 1] - cyView) * scale * ys + halfCssH);
        for (let k = 1; k < 6; k++) {
          ctx.lineTo((verts[off + k * 2] - cxView) * scale + halfCssW, (verts[off + k * 2 + 1] - cyView) * scale * ys + halfCssH);
        }
        ctx.closePath();
      }
    } else {
      const hwPx = w.halfW * scale, hhPx = w.halfH * scale;
      const rwPx = hwPx * 2, rhPx = hhPx * 2;
      const wcx = w.cx, wcy = w.cy;
      for (let i = 0; i < w.count; i++) {
        if (wcx[i] < visMinX || wcx[i] > visMaxX || wcy[i] < visMinY || wcy[i] > visMaxY) continue;
        const sx = (wcx[i] - cxView) * scale + halfCssW - hwPx;
        const sy = (wcy[i] - cyView) * scale * ys + halfCssH - hhPx;
        ctx.rect(sx, sy, rwPx, rhPx);
      }
    }
    ctx.stroke();
  }
}

/* ---- Interactive Brush / Flood Seed Footprint Preview ---- */
function renderCursor() {
  const canvas = dom.cursorCanvas;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const cs = activeChipState();
  if (!cs || !S.hover.inside || S.hover.wellIdx < 0 || S.tool === 'pan') return;

  const w = cs.wells;
  const dpr = S.view.dpr;
  const scale = S.view.scale;
  const ys = ySign();
  const cxView = S.view.cx, cyView = S.view.cy;
  const halfCssW = S.view.cssW * 0.5, halfCssH = S.view.cssH * 0.5;
  const isErase = S.tool === 'erase' || S.tool === 'flood_erase';
  const size = (S.tool === 'fill' || S.tool === 'erase') ? S.brushSize : 1;
  const targetWells = getBrushWells(w, S.hover.wellIdx, size);
  if (targetWells.length === 0) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.strokeStyle = isErase ? '#ff645c' : '#58d8f5';
  ctx.fillStyle = isErase ? 'rgba(255, 100, 92, 0.18)' : 'rgba(88, 216, 245, 0.18)';
  ctx.lineWidth = 1.5;

  const hwPx = w.halfW * scale, hhPx = w.halfH * scale;
  const rwPx = hwPx * 2, rhPx = hhPx * 2;
  ctx.beginPath();
  if (w.shape === 'hex' && w.verts) {
    const verts = w.verts;
    for (let j = 0; j < targetWells.length; j++) {
      const off = targetWells[j] * 12;
      ctx.moveTo((verts[off] - cxView) * scale + halfCssW, (verts[off + 1] - cyView) * scale * ys + halfCssH);
      for (let k = 1; k < 6; k++) {
        ctx.lineTo((verts[off + k * 2] - cxView) * scale + halfCssW, (verts[off + k * 2 + 1] - cyView) * scale * ys + halfCssH);
      }
      ctx.closePath();
    }
  } else {
    for (let j = 0; j < targetWells.length; j++) {
      const idx = targetWells[j];
      const sx = (w.cx[idx] - cxView) * scale + halfCssW - hwPx;
      const sy = (w.cy[idx] - cyView) * scale * ys + halfCssH - hhPx;
      ctx.rect(sx, sy, rwPx, rhPx);
    }
  }
  ctx.fill();
  ctx.stroke();
}
