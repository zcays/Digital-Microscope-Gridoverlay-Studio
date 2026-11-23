'use strict';
/* export.js — "Export PNG". buildExportCanvas() composites, at full canvas resolution:
 *   1. the image layer (re-rendered at full quality by render.js so lens correction, distortion and crop are included), then
 *   2. the grid drawn on top (grid.js, k = 1).
 * The checkboxes #exImg / #exGrid choose the layers. Normally the result is exactly S.doc.w × S.doc.h px.
 * With "Crop to array" on (S.chip.arrayOnly, a chip ticked and fitted) the PNG is cut to the array plus the chosen margin
 * (S.chip.arrayPad: half a well, half a wall, or none), rounded to whole pixels (see arrayCropRect() in grid.js). Pass array: false to get the whole canvas.
 * History: drawGrid() used to clear its canvas first, which erased the image and exported only the grid — it no longer clears. */

function buildExportCanvas({image = $('#exImg').checked, grid = $('#exGrid').checked, array = true} = {}) {
  const r = array ? arrayCropRect() : null, full = document.createElement('canvas');
  full.width = S.doc.w; full.height = S.doc.h;
  const fCtx = full.getContext('2d');
  if (image && S.img.el) { renderImage({full: true}); fCtx.drawImage(dom.gl, 0, 0, S.doc.w, S.doc.h); }
  if (grid) drawGrid(fCtx, S.doc.w, S.doc.h, 1);
  if (!r) return full;
  const c = document.createElement('canvas');
  c.width = r.w; c.height = r.h;
  c.getContext('2d').drawImage(full, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
  return c;
}
/** File name of the export: says which chip and that it is the array only, so the files are not mixed up. */
function exportFileName() {
  return arrayCropRect() ? `array-${String(S.chip.id).replace(/[^\w.-]+/g, '_')}.png` : 'grid-overlay.png';
}

function exportPng() {
  buildExportCanvas().toBlob(blob => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = exportFileName(); a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/png');
}
