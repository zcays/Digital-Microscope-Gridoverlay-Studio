'use strict';
/* presets.js — the physical scale a ticked chip version implies, and ticking / fitting chips.
 *
 * DATA:  the chip versions themselves are the live list CHIPS (chiplist.js), filled from ../chips.js or a loaded JSON/CSV file.
 *        All lengths are µm. pitch = well + wall. Only shape / well / pitch / wide / long affect drawing.
 * SCALE: pxPerUm() = canvas px per µm for the ticked chip (null when none). Everything true-to-scale derives from it
 *        (well px = well µm × k, pitch px = pitch µm × k), so well : wall : pitch proportions are always exact.
 *        Two modes: S.chip.fit (canvas = array + dead-room border, the default) or tile across a fixed canvas.
 * IMAGE: umPerPx() = the image's µm per pixel. keepingImageScale() keeps it constant when the grid scale/chip changes
 *        (the microscope doesn't change), so changing chips rescales the image along with the grid.
 * Every change of chip / fit / dead room goes through keepingImageScale(): selectChip(), setChipFit(), setChipMargin().
 * Draft angle, bottom shape and depth are NOT drawn (2-D top view only). */

const AUTO_PITCH_PX = 48;                   // tiled (not fit) mode: one well pitch is drawn this many canvas px wide
const FIT_TARGET_PX = 2000;                 // fit-canvas mode: the array's longer side is about this many canvas px

/** Real extent of the N × M array in µm (first well edge to last well edge) and the dead-room border around it. */
function chipGeometry(P) {
  const extX = P.wide * P.pitch - (P.pitch - P.well), extY = P.long * P.pitch - (P.pitch - P.well);
  return {extX, extY, longest: Math.max(extX, extY), borderUm: Math.max(Math.max(extX, extY) * S.chip.margin / 100, (P.pitch - P.well) / 2)};   // never less than half a wall, so the array's outer edge is always on the canvas
}

const activePreset = () => S.chip.id ? CHIPS.find(c => c.id === S.chip.id) : null;
/** Canvas pixels per µm for the active chip (null when no chip is ticked). */
function pxPerUm() {
  const P = activePreset(); if (!P) return null;
  const base = S.chip.fit ? FIT_TARGET_PX / (chipGeometry(P).longest * 1.16) : AUTO_PITCH_PX / P.pitch;
  return base;
}
/** Current image calibration in µm per image pixel (null without chip or image). */
const umPerPx = () => { const k = pxPerUm(); return k && S.img.el ? S.img.scale / k : null; };

/** Resize the canvas to the array plus dead room (or restore the old size). Returns true if the canvas size changed. */
function applyChipCanvas() {
  const P = activePreset(), C = S.chip, before = `${S.doc.w}x${S.doc.h}`;
  if (P && C.fit) {
    if (!C.savedDoc) C.savedDoc = {...S.doc};
    const g = chipGeometry(P), k = pxPerUm();
    S.doc = {w: clamp(Math.round((g.extX + 2 * g.borderUm) * k), 16, MAX_DOC), h: clamp(Math.round((g.extY + 2 * g.borderUm) * k), 16, MAX_DOC)};
  } else if (C.savedDoc) { S.doc = C.savedDoc; C.savedDoc = null; }
  return before !== `${S.doc.w}x${S.doc.h}`;
}

/** Run `change`, keep the image's µm-per-pixel (the microscope doesn't change), then refit the canvas. */
function keepingImageScale(change) {
  const u = umPerPx();
  change();
  if (!activePreset() || !S.chip.fit) S.chip.arrayOnly = false;       // "Crop to array" has nothing to crop to any more: switch it off rather than have it come back later unasked
  const k = pxPerUm();
  if (u && k) S.img.scale = u * k;
  if (applyChipCanvas()) fitZoom();
  if (!u && S.img.el && activePreset()) fitImageToCanvas();   // first tick: start with the image fitted, then adjust it to the wells
  refresh('gl', 'grid', 'layout', 'crop', 'status');
}
function selectChip(id) { keepingImageScale(() => S.chip.id = id); }
function setChipFit(on) { keepingImageScale(() => S.chip.fit = on); }
function setChipMargin(pct) { keepingImageScale(() => S.chip.margin = clamp(pct, 0, 40)); }

function updateChipInfo() {
  const el = $('#chipInfo'), P = activePreset();
  if (!el) return;
  if (!P) {
    const emptyMsg = 'No chip ticked: the grid uses the manual settings below.';
    if (el._lastHtml !== emptyMsg) { el._lastHtml = emptyMsg; el.textContent = emptyMsg; }
    return;
  }
  const k = pxPerUm(), u = umPerPx();
  const bottomText = P.bottom ? ` · bottom: ${escHtml(P.bottom)}` : '';
  const draftText = P.draft ? ` · draft ${escHtml(P.draft)}` : '';
  const depthText = P.depth !== null && P.depth !== undefined ? ` · depth ${escHtml(P.depth)} µm` : '';
  const html = [
    `<b>${escHtml(P.id)}</b> · ${escHtml(P.shape)} wells${bottomText}${draftText}`,
    `pitch ${escHtml(P.pitch)} µm · well ${escHtml(P.well)} µm · wall ${escHtml(P.wall)} µm${depthText}`,
    `array ${escHtml(P.widthUm)} × ${escHtml(P.lengthUm)} µm (${escHtml(P.wide)} × ${escHtml(P.long)} wells)${S.chip.fit ? ' · canvas fitted to array' : ''}`,
    `<b>Scale:</b> ${k.toFixed(3)} px/µm → pitch ${(P.pitch * k).toFixed(1)} px, well ${(P.well * k).toFixed(1)} px`,
    `Canvas shows ${Math.round(S.doc.w / k)} × ${Math.round(S.doc.h / k)} µm`,
    u ? `<b>Image: ${u.toFixed(3)} µm per pixel</b>` : '',
  ].filter(Boolean).join('<br>');
  if (el._lastHtml !== html) { el._lastHtml = html; el.innerHTML = html; }
}

