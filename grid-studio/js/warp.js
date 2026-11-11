'use strict';
/* Free distortion of the image layer. Eight handles: 4 corners and 4 sides.
 *   corner drag      → moves that corner (skew / perspective-like)
 *   side drag        → moves the whole edge (both of its corners)
 *   Alt + side drag  → bows the edge into a curve (stored as an offset from the edge's midpoint)
 * Points are in canvas-normalised coordinates (0..1, y down). The warp is a biquadratic patch over
 * a 3 × 3 control grid, so with untouched handles it is exactly the identity. */

const SIDE_ENDS = {n: ['nw', 'ne'], e: ['ne', 'se'], s: ['se', 'sw'], w: ['sw', 'nw']};
const CORNERS = ['nw', 'ne', 'se', 'sw'], SIDES = ['n', 'e', 's', 'w'];

const midpoint = (a, b) => ({x: (a.x + b.x) / 2, y: (a.y + b.y) / 2});
const sidePoint = k => { const m = midpoint(S.warp.c[SIDE_ENDS[k][0]], S.warp.c[SIDE_ENDS[k][1]]), d = S.warp.dev[k]; return {x: m.x + d.x, y: m.y + d.y}; };

/** 3 × 3 control points, [row (top→bottom)][col (left→right)]. */
function warpControlPoints() {
  const {c, dev} = S.warp;
  const avg = {x: (c.nw.x + c.ne.x + c.se.x + c.sw.x) / 4, y: (c.nw.y + c.ne.y + c.se.y + c.sw.y) / 4};
  const centre = {                                         // follows the average of the edge bows
    x: avg.x + (dev.n.x + dev.e.x + dev.s.x + dev.w.x) / 2,
    y: avg.y + (dev.n.y + dev.e.y + dev.s.y + dev.w.y) / 2,
  };
  return [[c.nw, sidePoint('n'), c.ne], [sidePoint('w'), centre, sidePoint('e')], [c.sw, sidePoint('s'), c.se]];
}

const lagrange = t => [2 * (t - .5) * (t - 1), -4 * t * (t - 1), 2 * t * (t - .5)];   // quadratic basis at t = 0, .5, 1
function warpPoint(u, v, P = warpControlPoints()) {
  const lu = lagrange(u), lv = lagrange(v); let x = 0, y = 0;
  for (let j = 0; j < 3; j++) for (let i = 0; i < 3; i++) { const w = lv[j] * lu[i]; x += w * P[j][i].x; y += w * P[j][i].y; }
  return {x, y};
}

function warpActive() {
  const d = defaultWarp(), near = (a, b) => Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
  return CORNERS.some(k => !near(S.warp.c[k], d.c[k])) || SIDES.some(k => !near(S.warp.dev[k], d.dev[k]));
}
function resetWarp() { const keep = S.warp.enabled; Object.assign(S.warp, defaultWarp(), {enabled: keep}); refresh('gl', 'warp'); }

/** Vertex data for the GL mesh: clip x, clip y, texture u, texture v (flipped to match the offscreen texture). */
function warpMesh(n) {
  const P = warpControlPoints(), out = new Float32Array((n + 1) * (n + 1) * 4); let o = 0;
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) {
    const u = i / n, v = j / n, p = warpPoint(u, v, P);
    out[o++] = p.x * 2 - 1; out[o++] = 1 - p.y * 2; out[o++] = u; out[o++] = 1 - v;
  }
  return out;
}

/* ---------------- on-canvas overlay (outline, inner guide lines, 8 handles) ---------------- */
const SVG_NS = 'http://www.w3.org/2000/svg';
let warpSvg, warpPath, warpHandles = {};

function buildWarpOverlay() {
  warpSvg = document.createElementNS(SVG_NS, 'svg'); warpSvg.id = 'warpsvg';
  warpPath = document.createElementNS(SVG_NS, 'path'); warpSvg.append(warpPath);
  dom.stage.append(warpSvg);
  for (const k of [...CORNERS, ...SIDES]) {
    const h = document.createElement('i'); h.className = 'wh ' + (SIDES.includes(k) ? 'side' : 'corner'); h.dataset.w = k;
    h.title = SIDES.includes(k) ? 'Drag: move edge · Alt+drag: bend edge' : 'Drag: move corner';
    dom.stage.append(h); warpHandles[k] = h;
  }
}

function updateWarpUI() {
  const show = S.tool === 'warp' && S.img.el;
  warpSvg.style.display = show ? 'block' : 'none';
  for (const h of Object.values(warpHandles)) h.style.display = show ? 'block' : 'none';
  if (!show) return;
  const W = S.doc.w * S.zoom, H = S.doc.h * S.zoom, P = warpControlPoints(), px = p => `${(p.x * W).toFixed(1)} ${(p.y * H).toFixed(1)}`;
  const curve = (fixed, isU) => { let d = ''; for (let t = 0; t <= 24; t++) d += (t ? 'L' : 'M') + px(isU ? warpPoint(fixed, t / 24, P) : warpPoint(t / 24, fixed, P)); return d; };
  warpPath.setAttribute('d', [0, .25, .5, .75, 1].map(t => curve(t, true) + curve(t, false)).join(''));
  for (const k of CORNERS) place(warpHandles[k], S.warp.c[k], W, H);
  for (const k of SIDES) place(warpHandles[k], sidePoint(k), W, H);
}
function place(el, p, W, H) { el.style.left = p.x * W + 'px'; el.style.top = p.y * H + 'px'; }
