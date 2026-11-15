'use strict';
/* main.js — the frame loop and start-up. Loaded LAST: it runs init() as soon as it is parsed.
 *
 * frame() is called by the scheduler in state.js (dirty()). It redraws only what is flagged stale, in this order:
 *   layout (stage size) → gl (image) → grid (overlay) → crop box → distort handles → status bar. */

function frame() {
  rafId = 0;
  const f = dirtyFlags;
  if (f.sync) { flushSyncAll(); f.sync = false; }
  if (f.layout) { layout(); f.layout = false; f.gl = true; }
  if (f.gl) { renderImage(); f.gl = false; }
  if (f.grid) { renderGrid(); f.grid = false; }
  if (f.crop) { updateCrop(); f.crop = false; }
  if (f.warp) { updateWarpUI(); f.warp = false; }
  if (f.status) { updateStatusBar(); f.status = false; }
  updateArrayMask();                                             // "Crop to array" (cheap; depends on chip, canvas and grid offsets)
}

function wireTopBar() {
  const fileIn = $('#file'), cbArray = $('#exArray');
  fileIn.onchange = e => { loadFile(e.target.files[0]); e.target.value = ''; };
  dom.emptyHint.onclick = e => { if (e.button === 0 && !panMode && !S.img.el) fileIn.click(); };
  $('#settingsSave').onclick = saveSettings;
  $('#settingsLoad').onclick = () => $('#settingsFile').click();
  $('#settingsFile').onchange = e => { loadSettingsFile(e.target.files[0]); e.target.value = ''; };
  $('#sample').onclick = loadSample;
  $('#undo').onclick = undoCrop;
  $('#export').onclick = exportPng;
  $('#helpBtn').onclick = () => toggleHelp();
  cbArray.onchange = e => setArrayOnly(e.target.checked);            // same setting as "Crop to array" in the Crop panel
  syncs.push(() => {
    const ok = !!arrayRect(), title = ok
      ? 'Show and export exactly the array: all wells plus half a wall around them, nothing more (same as “Crop to array” in the Crop panel)'
      : 'Tick a chip version (with "Fit canvas to array") to use this';
    cbArray.checked = S.chip.arrayOnly && ok;
    cbArray.disabled = !ok;
    if (cbArray.parentElement.title !== title) cbArray.parentElement.title = title;
  });
  document.querySelectorAll('.tool').forEach(b => b.onclick = () => setTool(b.dataset.tool));
  $('#zIn').onclick = zoomIn; $('#zOut').onclick = zoomOut; $('#zFit').onclick = fitZoom; $('#z100').onclick = () => setZoom(1);

  dom.ws.addEventListener('dragover', e => e.preventDefault());                       // drop an image or settings file onto the workspace
  dom.ws.addEventListener('drop', e => { e.preventDefault(); loadWorkspaceFile(e.dataTransfer.files[0]); });
  addEventListener('paste', e => { const f = e.clipboardData && e.clipboardData.files[0]; if (f) loadWorkspaceFile(f, true); });
  addEventListener('resize', () => { if (!S.img.el) fitZoom(); });
  addEventListener('load', () => { if (!S.img.el) fitZoom(); });                     // layout is not measurable before load
}

function init() {
  initRenderer();
  buildWarpOverlay();
  buildPanels();
  wireTopBar();
  updateCursor(); updateKeyHint(); fitZoom();
  dirty('gl', 'grid', 'crop', 'status', 'warp');
}
init();
