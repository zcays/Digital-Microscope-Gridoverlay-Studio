'use strict';
/* Frame loop, export, file input wiring and start-up. */

function frame() {
  rafId = 0;
  const f = dirtyFlags;
  if (f.layout) { layout(); f.layout = false; f.gl = true; }
  if (f.gl) { renderGL(); f.gl = false; }
  if (f.grid) { renderGrid(); f.grid = false; }
  if (f.crop) { updateCrop(); f.crop = false; }
  if (f.status) {
    $('#sInfo').textContent = `${S.doc.w} × ${S.doc.h} px`;
    $('#sZoom').textContent = Math.round(S.zoom * 100) + '%';
    $('#sPos').textContent = S.cursor ? `x ${Math.round(S.cursor.x)}  y ${Math.round(S.cursor.y)}` : '';
    f.status = false;
  }
}

/** Render image and/or grid at full document resolution and download as PNG. */
function exportPng() {
  const c = document.createElement('canvas'); c.width = S.doc.w; c.height = S.doc.h;
  const ctx = c.getContext('2d');
  if ($('#exImg').checked && S.img.el) { renderGL(); ctx.drawImage(dom.gl, 0, 0); }
  if ($('#exGrid').checked) drawGrid(ctx, S.doc.w, S.doc.h, 1);
  c.toBlob(blob => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'grid-overlay.png'; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/png');
}

function wireTopBar() {
  $('#file').onchange = e => { loadFile(e.target.files[0]); e.target.value = ''; };
  $('#sample').onclick = loadSample;
  $('#undo').onclick = undoCrop;
  $('#export').onclick = exportPng;
  $('#helpBtn').onclick = () => toggleHelp();
  document.querySelectorAll('.tool').forEach(b => b.onclick = () => setTool(b.dataset.tool));
  $('#zIn').onclick = zoomIn; $('#zOut').onclick = zoomOut; $('#zFit').onclick = fitZoom; $('#z100').onclick = () => setZoom(1);

  dom.ws.addEventListener('dragover', e => e.preventDefault());
  dom.ws.addEventListener('drop', e => { e.preventDefault(); loadFile(e.dataTransfer.files[0]); });
  addEventListener('paste', e => { const f = e.clipboardData && e.clipboardData.files[0]; if (f) loadFile(f); });
  addEventListener('resize', () => { if (!S.img.el) fitZoom(); });
}

function init() {
  initGL();
  buildPanels();
  wireTopBar();
  updateCursor(); updateKeyHint(); fitZoom();
  dirty('gl', 'grid', 'crop', 'status');
}
init();
