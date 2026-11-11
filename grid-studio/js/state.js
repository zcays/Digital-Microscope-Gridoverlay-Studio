'use strict';
/* Shared state, DOM handles and the render-invalidation scheduler.
 * NOTE: S.img / S.lens / S.grid are mutated in place and never replaced,
 * so modules can safely hold references to them. */

const MAX_DOC = 8192;                       // largest canvas / texture edge, in px

const $ = sel => document.querySelector(sel);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const defaultLens = () => ({k1: 0, k2: 0, cx: .5, cy: .5, bypass: false});
const defaultImageTransform = () => ({x: 0, y: 0, scale: 1, rot: 0});

const S = {
  doc: {w: 1200, h: 800},
  img: {el: null, w: 0, h: 0, ...defaultImageTransform()},
  lens: defaultLens(),
  grid: {
    visible: true, mode: 'outline', color: '#ffffff', opacity: .75,
    size: 12, gapX: 12, gapY: 12,
    mL: 40, mR: 40, mT: 40, mB: 40, center: true,   // dead space around the array
    offX: 0, offY: 0, cols: 0, rows: 0,              // 0 = as many as fit
    radius: 0, stroke: 1,
  },
  zoom: 1, tool: 'move', crop: null, ratio: 0, cursor: null,
};
const undoStack = [];                       // crop history: {doc, x, y}

const dom = {
  stage: $('#stage'), ws: $('#ws'), gl: $('#gl'), grid: $('#grid'), cropbox: $('#cropbox'),
  emptyHint: $('#hint'), toast: $('#toast'),
};

/* ---- invalidation: mark what needs redrawing, flush once per animation frame ---- */
const dirtyFlags = {gl: true, grid: true, layout: true, crop: true, status: true};
let rafId = 0;
function dirty(...keys) {
  keys.forEach(k => dirtyFlags[k] = true);
  if (!rafId) rafId = requestAnimationFrame(frame);     // frame() lives in main.js
}

/* ---- settings panel sync: every control registers a function that re-reads state ---- */
const syncs = [];
const syncAll = () => syncs.forEach(fn => fn());
/** Update all controls from state, then schedule redraws. */
function refresh(...keys) { syncAll(); dirty(...keys); }

function toast(text) {
  dom.toast.textContent = text; dom.toast.style.display = 'block';
  clearTimeout(toast.timer); toast.timer = setTimeout(() => dom.toast.style.display = 'none', 2200);
}
