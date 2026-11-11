'use strict';
/* Tools, pointer interaction on the canvas, keyboard shortcuts and the help overlay. */

/* ---------------- tools & cursor ---------------- */
let drag = null, spaceDown = false;

function updateCursor() { dom.stage.style.cursor = S.tool === 'crop' ? 'crosshair' : S.tool === 'warp' ? 'default' : 'grab'; }
function setTool(tool) {
  S.tool = tool;
  document.querySelectorAll('.tool').forEach(b => b.classList.toggle('on', b.dataset.tool === tool));
  if (tool === 'crop' && S.img.el) startCrop();
  dom.stage.classList.toggle('warp', tool === 'warp');      // lets handles hang over the canvas edge
  updateCursor(); dirty('crop', 'warp');
}

/* ---------------- pointer drags (one handler per drag type) ---------------- */
const dragTypes = {
  pan: {
    start: e => ({sx: e.clientX, sy: e.clientY, left: dom.ws.scrollLeft, top: dom.ws.scrollTop}),
    move: (d, e) => { dom.ws.scrollLeft = d.left - (e.clientX - d.sx); dom.ws.scrollTop = d.top - (e.clientY - d.sy); },
  },
  image: {
    start: e => ({sx: e.clientX, sy: e.clientY, ix: S.img.x, iy: S.img.y}),
    move: (d, e) => { S.img.x = d.ix + (e.clientX - d.sx) / S.zoom; S.img.y = d.iy + (e.clientY - d.sy) / S.zoom; refresh('gl'); },
  },
  cropNew: {
    start: (e, p) => { S.crop = {x: p.x, y: p.y, w: 0, h: 0}; return {p0: p}; },
    move: (d, e, p) => { S.crop = rectFromPoints(d.p0, p, ratioValue()); },
  },
  cropMove: {
    start: (e, p) => ({p0: p, r0: {...S.crop}}),
    move: (d, e, p) => { S.crop = clampRect({...d.r0, x: d.r0.x + p.x - d.p0.x, y: d.r0.y + p.y - d.p0.y}); },
  },
  cropResize: {
    start: (e, p) => ({p0: p, r0: {...S.crop}, handle: e.target.dataset.h}),
    move: (d, e, p) => { S.crop = resizeRect(d.r0, d.handle, {x: p.x - d.p0.x, y: p.y - d.p0.y}, ratioValue()); },
  },
};
/* Distort handles: corner = move corner, side = move whole edge, Alt + side = bend edge. Deltas are in canvas-normalised units. */
const normPoint = p => ({x: p.x / S.doc.w, y: p.y / S.doc.h});
const warpDelta = (d, p) => { const n = normPoint(p); return {x: n.x - d.p0.x, y: n.y - d.p0.y}; };
const handleKey = e => e.target.dataset && e.target.dataset.w;
Object.assign(dragTypes, {
  warpCorner: {
    start: (e, p) => { const key = handleKey(e); return {key, p0: normPoint(p), c0: {...S.warp.c[key]}}; },
    move: (d, e, p) => { const m = warpDelta(d, p); S.warp.c[d.key] = {x: d.c0.x + m.x, y: d.c0.y + m.y}; dirty('gl', 'warp'); },
  },
  warpEdge: {
    start: (e, p) => { const ends = SIDE_ENDS[handleKey(e)]; return {ends, p0: normPoint(p), c0: ends.map(k => ({...S.warp.c[k]}))}; },
    move: (d, e, p) => { const m = warpDelta(d, p); d.ends.forEach((k, i) => S.warp.c[k] = {x: d.c0[i].x + m.x, y: d.c0[i].y + m.y}); dirty('gl', 'warp'); },
  },
  warpBow: {
    start: (e, p) => { const key = handleKey(e); return {key, p0: normPoint(p), v0: {...S.warp.dev[key]}}; },
    move: (d, e, p) => { const m = warpDelta(d, p); S.warp.dev[d.key] = {x: d.v0.x + m.x, y: d.v0.y + m.y}; dirty('gl', 'warp'); },
  },
});
const insideRect = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

function pickDragType(e, p) {
  if (e.button === 1 || spaceDown) return 'pan';
  if (e.button !== 0) return null;
  if (!S.img.el) return null;
  if (S.tool === 'move') return 'image';
  if (S.tool === 'warp') { const k = handleKey(e); return !k ? null : CORNERS.includes(k) ? 'warpCorner' : e.altKey ? 'warpBow' : 'warpEdge'; }
  if (e.target.dataset && e.target.dataset.h) return 'cropResize';
  return S.crop && insideRect(p, S.crop) ? 'cropMove' : 'cropNew';
}

dom.stage.addEventListener('pointerdown', e => {
  const p = docPoint(e), type = pickDragType(e, p);
  if (!type) return;
  e.preventDefault();
  if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();   // arrows go back to the image
  drag = {type, ...dragTypes[type].start(e, p)};
  dom.stage.setPointerCapture(e.pointerId);
  if (type === 'image') dom.stage.style.cursor = 'grabbing';
});
dom.stage.addEventListener('pointermove', e => {
  const p = docPoint(e); S.cursor = p; dirty('status');
  if (!drag) return;
  dragTypes[drag.type].move(drag, e, p);
  if (drag.type.startsWith('crop')) dirty('crop');
});
function endDrag() {
  if (drag && drag.type === 'cropNew' && !(S.crop.w >= 2 && S.crop.h >= 2)) { S.crop = null; startCrop(); }   // a click, not a drag
  drag = null; updateCursor(); dirty('crop');
}
dom.stage.addEventListener('pointerup', endDrag);
dom.stage.addEventListener('pointercancel', endDrag);
dom.ws.addEventListener('wheel', e => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom(S.zoom * Math.exp(-e.deltaY * .0025)); } }, {passive: false});

/* ---------------- help overlay ---------------- */
const helpEl = $('#help');
const helpOpen = () => helpEl.style.display === 'flex';
function toggleHelp(show = !helpOpen()) { helpEl.style.display = show ? 'flex' : 'none'; }
helpEl.onclick = e => { if (e.target === helpEl) toggleHelp(false); };

/* ---------------- keyboard ---------------- */
// Single-key shortcuts (letters matched case-insensitively). Ignored while typing in a text/number field.
const KEY_ACTIONS = {
  v: () => setTool('move'), c: () => setTool('crop'), d: () => setTool('warp'), g: toggleGrid, h: toggleHelp, '?': toggleHelp,
  r: resetImageTransform, m: centerImage, f: fitZoom, 0: fitZoom, 1: () => setZoom(1),
  '+': zoomIn, '=': zoomIn, '-': zoomOut, _: zoomOut,
  '[': () => nudgeGridSize(-1), ']': () => nudgeGridSize(1), '{': () => nudgeGridSpacing(-1), '}': () => nudgeGridSpacing(1),
  '\\': toggleBypass,
};
const MOD_ACTIONS = {z: undoCrop, o: () => $('#file').click(), e: () => $('#export').click()};
const ARROW_NUDGE = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]};

addEventListener('keydown', e => {
  const t = e.target, tag = t.tagName, inField = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
  const typing = tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && ['number', 'text'].includes(t.type));
  const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

  if (key === 'Escape') {
    if (helpOpen()) return toggleHelp(false);
    if (inField) return t.blur();
    if (S.tool === 'crop') return cancelCrop();
    if (S.tool === 'warp') return setTool('move');
    return;
  }
  if (ARROW_NUDGE[key]) {                                   // a focused setting handles its own arrows (see controls.js)
    if (inField) return;
    e.preventDefault();
    const step = (e.shiftKey ? 10 : 1) * (e.altKey ? .1 : 1), [dx, dy] = ARROW_NUDGE[key];
    return nudgeImage(dx * step, dy * step);
  }
  if (e.metaKey || e.ctrlKey) { const act = MOD_ACTIONS[key]; if (act) { e.preventDefault(); act(); } return; }
  if (typing || e.altKey) return;

  if (key === 'Enter') { if (S.tool === 'crop' && !inField && tag !== 'BUTTON') applyCrop(); return; }
  if (key === ' ') { if (!inField && tag !== 'BUTTON') { spaceDown = true; dom.stage.style.cursor = 'grab'; e.preventDefault(); } return; }
  const act = KEY_ACTIONS[key]; if (act) act();
});
addEventListener('keyup', e => { if (e.key === ' ') { spaceDown = false; updateCursor(); } });

/* ---------------- status-bar hint reflects what the arrow keys will do ---------------- */
function updateKeyHint() {
  const a = document.activeElement, onSetting = a && a.tagName === 'INPUT' && ['range', 'number'].includes(a.type);
  $('#sHint').textContent = onSetting
    ? 'Setting selected: ←/→ or ↑/↓ adjust · Shift ×10 · Alt ×0.1 · Esc = back to image'
    : 'Arrows nudge image (Shift ×10, Alt ×0.1) · ? = all shortcuts';
}
addEventListener('focusin', updateKeyHint);
addEventListener('focusout', () => setTimeout(updateKeyHint, 0));
