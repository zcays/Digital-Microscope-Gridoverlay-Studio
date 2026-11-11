'use strict';
/* Crop selection geometry, apply and undo. Rects are {x, y, w, h} in document pixels. */

const rectHasArea = r => r && r.w >= 1 && r.h >= 1;

function clampRect(r) {
  r.w = Math.min(r.w, S.doc.w); r.h = Math.min(r.h, S.doc.h);
  r.x = clamp(r.x, 0, S.doc.w - r.w); r.y = clamp(r.y, 0, S.doc.h - r.h);
  return r;
}
/** Active aspect ratio (w/h) or 0 for free. */
function ratioValue() { return S.ratio === -1 ? (S.img.el ? S.doc.w / S.doc.h : 0) : S.ratio; }

/** Rect dragged out from corner `a` to point `b`, optionally locked to an aspect ratio. */
function rectFromPoints(a, b, ratio) {
  b = {x: clamp(b.x, 0, S.doc.w), y: clamp(b.y, 0, S.doc.h)};
  let w = b.x - a.x, h = b.y - a.y;
  if (ratio) {
    const aw = Math.abs(w), ah = Math.abs(h), sx = Math.sign(w) || 1, sy = Math.sign(h) || 1;
    if (aw / Math.max(ah, 1e-6) > ratio) h = sy * aw / ratio; else w = sx * ah * ratio;
    const maxW = sx > 0 ? S.doc.w - a.x : a.x, maxH = sy > 0 ? S.doc.h - a.y : a.y;
    const shrink = Math.min(1, maxW / Math.abs(w), maxH / Math.abs(h)); w *= shrink; h *= shrink;
  }
  return {x: Math.min(a.x, a.x + w), y: Math.min(a.y, a.y + h), w: Math.abs(w), h: Math.abs(h)};
}

/** Resize `r0` by dragging handle `handle` ('n','se',…) by delta `d`. */
function resizeRect(r0, handle, d, ratio) {
  const has = c => handle.includes(c);
  let l = r0.x, t = r0.y, r = r0.x + r0.w, b = r0.y + r0.h;
  if (has('w')) l += d.x; if (has('e')) r += d.x;
  if (has('n')) t += d.y; if (has('s')) b += d.y;
  l = clamp(l, 0, S.doc.w); r = clamp(r, 0, S.doc.w); t = clamp(t, 0, S.doc.h); b = clamp(b, 0, S.doc.h);
  if (ratio) {
    const fixWidth = () => { const nw = (b - t) * ratio; if (has('w')) l = r - nw; else r = l + nw; };
    if (has('e') || has('w')) {                       // width drives height
      const nh = Math.abs(r - l) / ratio; if (has('n')) t = b - nh; else b = t + nh;
      if (b > S.doc.h) { b = S.doc.h; fixWidth(); }
      if (t < 0) { t = 0; fixWidth(); }
    } else {                                          // height drives width
      r = l + Math.abs(b - t) * ratio;
      if (r > S.doc.w) { r = S.doc.w; const nh = (r - l) / ratio; if (has('n')) t = b - nh; else b = t + nh; }
    }
  }
  return {x: Math.min(l, r), y: Math.min(t, b), w: Math.abs(r - l), h: Math.abs(b - t)};
}

function fitRatio(ratio) {
  const c = S.crop; if (!c || !ratio) return;
  let w = c.w, h = w / ratio;
  if (h > S.doc.h) { h = S.doc.h; w = h * ratio; }
  if (w > S.doc.w) { w = S.doc.w; h = w / ratio; }
  S.crop = clampRect({x: c.x + c.w / 2 - w / 2, y: c.y + c.h / 2 - h / 2, w, h});
}
function startCrop() {
  if (S.crop) return;
  const {w, h} = S.doc; S.crop = {x: w * .1, y: h * .1, w: w * .8, h: h * .8}; fitRatio(ratioValue());
}
function cancelCrop() { S.crop = null; setTool('move'); }

function applyCrop() {
  const c = S.crop; if (!rectHasArea(c)) return;
  undoStack.push({doc: {...S.doc}, x: S.img.x, y: S.img.y});
  S.img.x -= Math.round(c.x); S.img.y -= Math.round(c.y);          // shift image so the crop becomes the new origin
  S.doc = {w: Math.max(1, Math.round(c.w)), h: Math.max(1, Math.round(c.h))};
  S.crop = null; setTool('move'); afterDocChange();
}
function undoCrop() {
  const u = undoStack.pop(); if (!u) return;
  S.doc = u.doc; S.img.x = u.x; S.img.y = u.y; S.crop = null; afterDocChange();
}
function afterDocChange() { updateUndoButton(); fitZoom(); refresh('gl', 'layout', 'crop', 'status'); }
function updateUndoButton() { $('#undo').disabled = !undoStack.length; }

/** Position the on-canvas selection box and refresh the panel readout. */
function updateCrop() {
  const c = S.crop, show = S.tool === 'crop' && c, z = S.zoom;
  dom.cropbox.style.display = show ? 'block' : 'none';
  if (show) Object.assign(dom.cropbox.style, {left: c.x * z + 'px', top: c.y * z + 'px', width: c.w * z + 'px', height: c.h * z + 'px'});
  $('#cropInfo').textContent = c ? `Selection ${Math.round(c.w)} × ${Math.round(c.h)} px at (${Math.round(c.x)}, ${Math.round(c.y)})` : 'No selection';
  $('#cropApply').disabled = !rectHasArea(c);
}
