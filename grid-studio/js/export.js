'use strict';
/* export.js — "Export PNG": re-renders the image layer (with lens + distortion) and the grid at full canvas
 * resolution into an offscreen 2D canvas and downloads it. Checkboxes #exImg / #exGrid choose the layers. */

function exportPng() {
  const c = document.createElement('canvas'); c.width = S.doc.w; c.height = S.doc.h;
  const ctx = c.getContext('2d');
  if ($('#exImg').checked && S.img.el) { renderGL(); ctx.drawImage(dom.gl, 0, 0); }
  if ($('#exGrid').checked) drawGrid(ctx, S.doc.w, S.doc.h, 1);       // k = 1: grid drawn 1:1 in canvas px
  c.toBlob(blob => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'grid-overlay.png'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/png');
}
