'use strict';
/* main.js — Application bootstrap, dataset/metadata/session loading orchestration,
 * frame scheduler, topbar/panel wiring, drag-and-drop, and built-in sample loader. */

function flushFrame() {
  if (dirtyFlags.cellColors) {
    dirtyFlags.cellColors = false;
    computeCellColors();
    dirtyFlags.cells = true;
    dirtyFlags.legend = true;
  }
  if (dirtyFlags.bg) { dirtyFlags.bg = false; renderBgImage(); }
  if (dirtyFlags.cells) { dirtyFlags.cells = false; renderCells(); }
  if (dirtyFlags.overlay) { dirtyFlags.overlay = false; renderOverlay(); }
  if (dirtyFlags.cursor) { dirtyFlags.cursor = false; renderCursor(); }
  if (dirtyFlags.ui) { dirtyFlags.ui = false; syncAllControls(); }
  if (dirtyFlags.rois) { dirtyFlags.rois = false; renderRoiList(); }
  if (dirtyFlags.legend) { dirtyFlags.legend = false; renderLegend(); }
  if (dirtyFlags.status) { dirtyFlags.status = false; renderStatus(); }
}

/** Keep a label only when its well and the cells belonging to it can be identified after a rebuild. */
function preserveChipSegmentation(previous, next, oldRows, rows) {
  const old = previous.wells;
  const wells = next.wells;
  next.rois = cloneRoiList(previous.rois);
  next.nextRoiId = previous.nextRoiId;
  next.activeRoiId = previous.activeRoiId;
  let kept = 0;

  if (oldRows.length === rows.length && oldRows.every((row, i) => row === rows[i]) &&
      old.mode === wells.mode && old.shape === wells.shape && old.halfW === wells.halfW && old.halfH === wells.halfH) {
    const matching = new Int32Array(old.count).fill(-1);
    let sameIndices = old.count === wells.count && old.nRows === wells.nRows && old.nCols === wells.nCols;
    for (let i = 0; i < old.count; i++) {
      const j = wells.wellIdToIdx.get(old.wellIds[i]);
      if (j !== undefined && old.row[i] === wells.row[j] && old.col[i] === wells.col[j] &&
          old.cx[i] === wells.cx[j] && old.cy[i] === wells.cy[j]) {
        matching[i] = j;
      }
      if (matching[i] !== i) sameIndices = false;
    }

    const changed = new Uint8Array(wells.count);
    for (let i = 0; i < rows.length; i++) {
      const from = old.cellWellIdx[i];
      const to = wells.cellWellIdx[i];
      const match = from >= 0 ? matching[from] : -1;
      if ((from < 0 && to < 0) || (match >= 0 && match === to)) continue;
      sameIndices = false;
      if (match >= 0) changed[match] = 1;
      if (to >= 0) changed[to] = 1;
    }
    for (let i = 0; i < old.count; i++) {
      const j = matching[i];
      if (previous.wellRoi[i] && j >= 0 && !changed[j]) {
        next.wellRoi[j] = previous.wellRoi[i];
        kept++;
      }
    }
    if (sameIndices) next.history = previous.history;
  }

  recountRois(next);
  return kept;
}

/** Build and validate a workspace before replacing anything in the active one. */
function prepareChipWorkspace(ds, meta, derivedGrid, preserve = false) {
  const { x, y, chip } = ds.colMap;
  const xCol = ds.columns[x];
  const yCol = ds.columns[y];
  if (x === y || xCol?.kind !== 'number' || yCol?.kind !== 'number' ||
      !xCol.num.some((value, row) => Number.isFinite(value) && Number.isFinite(yCol.num[row]))) {
    throw new Error('Select two distinct numeric X and Y columns with valid coordinates.');
  }

  const chipCol = ds.columns[chip];
  const groups = new Map();
  if (!chipCol) {
    const all = new Int32Array(ds.rowCount);
    for (let i = 0; i < ds.rowCount; i++) all[i] = i;
    groups.set('default', all);
  } else {
    const counts = new Map();
    for (let r = 0; r < ds.rowCount; r++) {
      const key = getColumnString(chipCol, r) || 'unassigned';
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const cursors = new Map();
    for (const [key, count] of counts) {
      groups.set(key, new Int32Array(count));
      cursors.set(key, 0);
    }
    for (let r = 0; r < ds.rowCount; r++) {
      const key = getColumnString(chipCol, r) || 'unassigned';
      const cursor = cursors.get(key);
      groups.get(key)[cursor] = r;
      cursors.set(key, cursor + 1);
    }
  }

  const states = new Map();
  const droppedByChip = new Map();
  if (preserve) {
    for (const [key, cs] of S.chipStates) {
      droppedByChip.set(key, cs.rois.reduce((count, roi) => count + roi.wellCount, 0));
    }
  }

  for (const [chipName, rows] of groups) {
    const cs = createChipSegState(buildChipWells(ds, rows, chipName, meta, derivedGrid));
    const previous = preserve ? S.chipStates.get(chipName) : null;
    if (previous) {
      const kept = preserveChipSegmentation(previous, cs, S.chips.cellIndicesByChip.get(chipName), rows);
      droppedByChip.set(chipName, droppedByChip.get(chipName) - kept);
    } else if (meta.rois?.length) {
      for (const roi of meta.rois) createRoi(cs, roi.name, roi.color, false);
      cs.activeRoiId = cs.rois[0].id;
    } else {
      createRoi(cs, 'ROI 1', PALETTE_20[0], false);
    }
    states.set(chipName, cs);
  }

  const dropped = Array.from(droppedByChip.values()).reduce((sum, count) => sum + count, 0);
  return { groups, states, dropped, droppedByChip };
}

function publishChipWorkspace({ groups, states }, active = S.chips.active) {
  finishStagePointer();
  Object.assign(S.hover, { wellIdx: -1, cellIdx: -1, inside: false });
  S.chips.list = Array.from(groups.keys());
  S.chips.cellIndicesByChip = groups;
  S.chips.active = groups.has(active) ? active : S.chips.list[0];
  S.chipStates.clear();
  for (const [key, cs] of states) S.chipStates.set(key, cs);
}

function refreshChipWorkspace(resetView = true) {
  markPositionsDirty();
  S.cellColors.chip = '';
  syncCanvasSizes();
  if (resetView) fitViewToWells();
  populateColumnSelects();
  refresh('cellColors', 'bg', 'cells', 'overlay', 'cursor', 'ui', 'rois', 'legend', 'status');
}

function droppedLabelsMessage(count) {
  return count > 0 ? ` ${count.toLocaleString()} labeled wells could not be matched to the new grid.` : '';
}

function rebuildAllChips(resetView = true, colMap = S.data.colMap, derivedGrid = S.derivedGrid) {
  if (!S.data.rowCount) return 0;
  const next = prepareChipWorkspace({ ...S.data, colMap }, S.meta, derivedGrid, true);
  S.data.colMap = colMap;
  Object.assign(S.derivedGrid, derivedGrid);
  publishChipWorkspace(next);
  S.display.yInvert = S.meta.yInvert ?? Boolean(activeChipState()?.wells.yDown);
  refreshChipWorkspace(resetView);
  return next.dropped;
}

/** A successful replacement consumes preloaded metadata or the metadata supplied with this dataset. */
function applyLoadedDataset(parsed, meta = S.data.rowCount ? emptySegmentMetadata() : S.meta) {
  const dataset = { ...parsed, colMap: { ...parsed.colMap } };
  const nextMeta = { ...emptySegmentMetadata(), ...meta };
  const colorIdx = dataset.headers.indexOf(meta.colorColumn);
  if (colorIdx >= 0) dataset.colMap.color = colorIdx;
  const next = prepareChipWorkspace(dataset, meta, DEFAULT_DERIVED_GRID);
  publishChipWorkspace(next, '');
  Object.assign(S.data, dataset);
  Object.assign(S.meta, nextMeta);
  Object.assign(S.derivedGrid, DEFAULT_DERIVED_GRID);
  S.metaRev++;
  S.group = sanitizeGroupName(S.meta.group);
  S.display.cellSize = S.meta.cellSize ?? DEFAULT_CELL_SIZE;
  S.display.yInvert = S.meta.yInvert ?? Boolean(activeChipState()?.wells.yDown);
  refreshChipWorkspace();
}

async function loadCellSource(source, opts = {}, meta) {
  if (S.busy) return;
  S.busy = true;
  const label = opts.fileName || (typeof source !== 'string' && source.name) || 'cells';
  setProgress(true, `Reading ${label}…`, 5);
  try {
    const t0 = performance.now();
    const parsed = await parseTableAsync(source, opts, (pct, rows) => {
      setProgress(true, `Parsing ${label}… ${rows.toLocaleString()} cells`, pct);
    });
    setProgress(true, `Indexing ${parsed.rowCount.toLocaleString()} cells…`, 98);
    await new Promise(r => setTimeout(r, 0));
    applyLoadedDataset(parsed, meta);
    const ms = Math.round(performance.now() - t0);
    toast(`Loaded ${parsed.rowCount.toLocaleString()} cells from ${parsed.fileName} (${ms} ms)`, 2600);
  } catch (err) {
    toast(err.message || 'Could not load cell file.', 4500);
  } finally {
    setProgress(false);
    S.busy = false;
  }
}

function applyLoadedMetadata(meta) {
  const old = S.meta;
  const geometryChanged = old.array !== meta.array ||
    (old.chips !== meta.chips && (Object.keys(old.chips).length > 0 || Object.keys(meta.chips).length > 0));
  const next = S.data.rowCount && geometryChanged
    ? prepareChipWorkspace(S.data, meta, S.derivedGrid, true)
    : null;

  if (next) publishChipWorkspace(next);
  if (meta.group || (old.group && S.group === old.group)) S.group = sanitizeGroupName(meta.group);
  if (meta.cellSize !== null || old.cellSize === S.display.cellSize) S.display.cellSize = meta.cellSize ?? DEFAULT_CELL_SIZE;
  if (meta.yInvert !== null || old.yInvert !== null || next) {
    S.display.yInvert = meta.yInvert ?? Boolean(activeChipState()?.wells.yDown);
  }
  const colorIdx = S.data.headers.indexOf(meta.colorColumn);
  if (colorIdx >= 0) S.data.colMap.color = colorIdx;
  else if (S.data.headers[S.data.colMap.color] === old.colorColumn) {
    S.data.colMap.color = autoDetectColumns(S.data.columns, S.data.headers, S.data.rowCount).color;
  }
  Object.assign(S.meta, meta);
  S.metaRev++;
  refreshChipWorkspace(Boolean(next));
  return next?.dropped ?? 0;
}

function loadMetadataText(text, fileName) {
  const meta = parseMetadataText(text, fileName);
  const dropped = applyLoadedMetadata(meta);
  toast(`Loaded metadata ${fileName} (${meta.colorCount} colors).${droppedLabelsMessage(dropped)}`, dropped ? 4500 : 2600);
}

async function loadMetadataFile(file) {
  const table = S.data.columns;
  try {
    const text = await file.text();
    if (table !== S.data.columns) throw new Error('The dataset changed while reading metadata. Load the file again.');
    loadMetadataText(text, file.name);
  } catch (err) {
    toast(err.message || 'Could not load metadata file.', 4500);
  }
}

async function loadSessionOrLabelsFile(file) {
  const table = S.data.columns;
  try {
    const text = await file.text();
    if (table !== S.data.columns) throw new Error('The dataset changed while reading the file. Load it again.');
    const trimmed = text.trim();
    if (/\.json$/i.test(file.name) || trimmed.startsWith('{')) {
      const obj = JSON.parse(trimmed);
      if (obj && obj.kind === 'sugar-segment-session') {
        const res = applySessionSnapshot(obj);
        const warn = res.warnings.length ? ' — ' + res.warnings.join(' ') : '';
        toast(`Session restored: ${res.restoredRois} ROIs, ${res.restoredWells} wells${warn}`, 3400);
      } else {
        loadMetadataText(text, file.name);
      }
    } else {
      const res = await importSegmentationCsv(text, file.name);
      toast(`Imported "${res.groupName}" from ${file.name}: ${res.labeledWells} wells (${res.labeledCells.toLocaleString()} cells)`, 3400);
    }
  } catch (err) {
    toast(err.message || 'Could not load file.', 4500);
  }
}

function loadBgImageFile(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    S.display.bgImage = img;
    S.display.bgName = file.name;
    refresh('bg', 'ui');
    toast(`Loaded background image ${file.name}`, 2200);
  };
  img.onerror = () => {
    URL.revokeObjectURL(url);
    toast('Could not decode background image.', 3500);
  };
  img.src = url;
}

/** Built-in synthetic demo dataset (works both over surveyapps://app and double-click file://). */
async function loadBuiltInSample() {
  if (S.busy) return;
  try {
    let cells, metadata;
    if (typeof SEGMENT_SAMPLE_DATA !== 'undefined' && SEGMENT_SAMPLE_DATA.cells) {
      ({ cells, metadata } = SEGMENT_SAMPLE_DATA);
    } else {
      const [cellsResp, metaResp] = await Promise.all([
        fetch('sample/sample_cells.tsv'),
        fetch('sample/sample_metadata.json'),
      ]);
      if (!cellsResp.ok) throw new Error('Sample file not found.');
      cells = await cellsResp.text();
      metadata = metaResp.ok ? await metaResp.text() : '';
    }
    const meta = metadata ? parseMetadataText(metadata, 'sample_metadata.json') : emptySegmentMetadata();
    await loadCellSource(cells, { fileName: 'sample_cells.tsv' }, meta);
  } catch (err) {
    toast(err.message || 'Could not load built-in sample.', 3500);
  }
}

/* ---- Export Actions ---- */
function exportCsvAction() {
  try {
    const t0 = performance.now();
    const { blob, filename, rowCount } = buildCellSegmentationCsvBlob();
    triggerDownload(blob, filename);
    toast(`Exported ${filename} (${rowCount.toLocaleString()} cells, ${Math.round(performance.now() - t0)} ms)`, 2800);
  } catch (err) {
    toast(err.message || 'CSV export failed.', 4000);
  }
}

function exportSummaryAction() {
  try {
    const { text, filename } = buildRoiSummaryCsvText();
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    triggerDownload(blob, filename);
    toast(`Exported ${filename}`, 2400);
  } catch (err) {
    toast(err.message || 'Summary export failed.', 4000);
  }
}

function saveSessionAction() {
  try {
    const snap = buildSessionSnapshot();
    const blob = new Blob([JSON.stringify(snap, null, 2) + '\n'], { type: 'application/json;charset=utf-8' });
    const filename = `${fileStem(S.data.fileName)}.segment-session.json`;
    triggerDownload(blob, filename);
    toast(`Saved ${filename}`, 2400);
  } catch (err) {
    toast(err.message || 'Session save failed.', 4000);
  }
}

/* ---- DOM Cache & Control Wiring ---- */
function cacheDom() {
  const ids = [
    'app', 'top', 'fileName', 'fileInput', 'metaInput', 'sessionInput', 'bgInput',
    'sampleBtn', 'undoBtn', 'redoBtn', 'helpBtn', 'helpOverlay', 'helpClose',
    'exportCsvBtn', 'exportSummaryBtn', 'saveSessionBtn',
    'exportCsvBtn2', 'exportSummaryBtn2', 'saveSessionBtn2', 'importSessionBtn', 'importCsvBtn',
    'tools', 'ws', 'stage', 'bgCanvas', 'cellCanvas', 'overlayCanvas', 'cursorCanvas',
    'hint', 'progressWrap', 'progressLabel', 'progressBar', 'toast',
    'groupInput', 'chipRow', 'chipSelect', 'roiNameInput', 'roiColorInput', 'addRoiBtn',
    'roiList', 'segTotals', 'clearSegBtn',
    'brushSizeSlider', 'brushSizeVal', 'roiAlpha', 'roiAlphaVal',
    'autoResetFlood', 'showBorders', 'showRois', 'showCells',
    'colColor', 'colorLegend', 'numericColorOpts', 'colormapSelect', 'clipPercentile', 'logScale',
    'cellSizeSlider', 'cellSizeVal', 'cellAlphaSlider', 'cellAlphaVal', 'yInvert',
    'bgAlphaSlider', 'bgAlphaVal', 'bgClearBtn', 'bgInfo',
    'colX', 'colY', 'colCellId', 'colWellId', 'colRow', 'colCol', 'colChip',
    'gridInfo', 'derivedGridRow', 'derivedBinsSlider', 'derivedBinsVal', 'applyGridBtn',
    'metaInfo', 'clearMetaBtn',
    'statusText', 'zoomLabel', 'zoomOutBtn', 'zoomInBtn', 'zoomFitBtn',
  ];
  for (const id of ids) dom[id] = document.getElementById(id);
}

function bindControls() {
  // File inputs
  const bindFileInput = (input, load) => {
    if (!input) return;
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      input.value = '';
      if (file) load(file);
    });
  };
  bindFileInput(dom.fileInput, loadCellSource);
  bindFileInput(dom.metaInput, loadMetadataFile);
  bindFileInput(dom.sessionInput, loadSessionOrLabelsFile);
  bindFileInput(dom.bgInput, loadBgImageFile);

  // Click empty workspace card -> open cell file picker
  if (dom.hint) {
    dom.hint.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      if (e.button === 0 && S.data.rowCount === 0 && dom.fileInput) dom.fileInput.click();
    });
  }
  document.querySelectorAll('[data-action="load-sample"]').forEach(btn => {
    btn.addEventListener('click', () => loadBuiltInSample());
  });
  if (dom.sampleBtn) dom.sampleBtn.addEventListener('click', () => loadBuiltInSample());

  // Drag & drop files anywhere onto workspace
  if (dom.ws) {
    dom.ws.addEventListener('dragover', e => { e.preventDefault(); dom.ws.classList.add('dragover'); });
    dom.ws.addEventListener('dragleave', () => dom.ws.classList.remove('dragover'));
    dom.ws.addEventListener('drop', async e => {
      e.preventDefault();
      dom.ws.classList.remove('dragover');
      const files = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
      for (const f of files) {
        if (/\.json$/i.test(f.name)) {
          await loadSessionOrLabelsFile(f);
        } else if (/\.(png|jpe?g|webp|bmp|tif|tiff)$/i.test(f.name)) {
          loadBgImageFile(f);
        } else {
          await loadCellSource(f);
        }
      }
    });
  }

  // Tool rail
  document.querySelectorAll('#tools .tool[data-tool]').forEach(btn => {
    btn.addEventListener('click', () => setTool(btn.dataset.tool));
  });

  // Undo / Redo / Help
  if (dom.undoBtn) {
    dom.undoBtn.addEventListener('click', () => {
      const cs = activeChipState();
      const entry = cs && undoSeg(cs);
      if (entry) { toast('Undid: ' + entry.label, 1800); dirty('overlay', 'rois', 'status'); }
    });
  }
  if (dom.redoBtn) {
    dom.redoBtn.addEventListener('click', () => {
      const cs = activeChipState();
      const entry = cs && redoSeg(cs);
      if (entry) { toast('Redid: ' + entry.label, 1800); dirty('overlay', 'rois', 'status'); }
    });
  }
  if (dom.helpBtn && dom.helpOverlay) {
    dom.helpBtn.addEventListener('click', () => { dom.helpOverlay.style.display = 'flex'; });
    dom.helpOverlay.addEventListener('click', e => { if (e.target === dom.helpOverlay) dom.helpOverlay.style.display = 'none'; });
  }
  if (dom.helpClose && dom.helpOverlay) {
    dom.helpClose.addEventListener('click', () => { dom.helpOverlay.style.display = 'none'; });
  }

  // Exports & Imports
  if (dom.exportCsvBtn) dom.exportCsvBtn.addEventListener('click', exportCsvAction);
  if (dom.exportCsvBtn2) dom.exportCsvBtn2.addEventListener('click', exportCsvAction);
  if (dom.exportSummaryBtn) dom.exportSummaryBtn.addEventListener('click', exportSummaryAction);
  if (dom.exportSummaryBtn2) dom.exportSummaryBtn2.addEventListener('click', exportSummaryAction);
  if (dom.saveSessionBtn) dom.saveSessionBtn.addEventListener('click', saveSessionAction);
  if (dom.saveSessionBtn2) dom.saveSessionBtn2.addEventListener('click', saveSessionAction);
  if (dom.importSessionBtn && dom.sessionInput) dom.importSessionBtn.addEventListener('click', () => dom.sessionInput.click());
  if (dom.importCsvBtn && dom.sessionInput) dom.importCsvBtn.addEventListener('click', () => dom.sessionInput.click());

  // ROI creation & group name
  if (dom.groupInput) {
    dom.groupInput.addEventListener('change', () => {
      S.group = sanitizeGroupName(dom.groupInput.value);
      dom.groupInput.value = S.group;
    });
  }
  if (dom.chipSelect) {
    dom.chipSelect.addEventListener('change', () => {
      const nextChip = dom.chipSelect.value;
      if (S.chipStates.has(nextChip)) {
        finishStagePointer();
        S.chips.active = nextChip;
        markPositionsDirty();
        S.cellColors.chip = '';
        fitViewToWells();
        refresh('cellColors', 'bg', 'cells', 'overlay', 'cursor', 'ui', 'rois', 'legend', 'status');
      }
    });
  }
  const addRoiAction = () => {
    const cs = activeChipState();
    if (!cs) { toast('Load a cell file first.', 2200); return; }
    const rawName = (dom.roiNameInput && dom.roiNameInput.value.trim()) || `ROI ${cs.rois.length + 1}`;
    const colVal = (dom.roiColorInput && dom.roiColorInput.dataset.custom === '1') ? dom.roiColorInput.value : getNextRoiColor(cs);
    try {
      const roi = createRoi(cs, rawName, colVal, true);
      if (dom.roiNameInput) dom.roiNameInput.value = '';
      if (dom.roiColorInput) {
        dom.roiColorInput.dataset.custom = '0';
        dom.roiColorInput.value = getNextRoiColor(cs);
      }
      if (S.tool === 'erase' || S.tool === 'flood_erase') setTool('fill');
      dirty('rois', 'status');
      toast(`Created ROI "${roi.name}"`, 1800);
    } catch (err) {
      toast(err.message, 3000);
    }
  };
  if (dom.addRoiBtn) dom.addRoiBtn.addEventListener('click', addRoiAction);
  if (dom.roiNameInput) {
    dom.roiNameInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); addRoiAction(); }
    });
  }
  if (dom.roiColorInput) {
    dom.roiColorInput.addEventListener('input', () => { dom.roiColorInput.dataset.custom = '1'; });
  }
  if (dom.clearSegBtn) {
    dom.clearSegBtn.addEventListener('click', () => {
      const cs = activeChipState();
      if (!cs) return;
      const n = clearChipSegmentation(cs);
      if (n > 0) {
        dirty('overlay', 'rois', 'status');
        toast(`Cleared ${n.toLocaleString()} wells (Ctrl/⌘+Z to undo)`, 2400);
      }
    });
  }

  // Brush & Overlay controls
  document.querySelectorAll('.brush-preset').forEach(btn => {
    btn.addEventListener('click', () => setBrushSize(Number(btn.dataset.size)));
  });
  if (dom.brushSizeSlider) {
    dom.brushSizeSlider.addEventListener('input', () => setBrushSize(Number(dom.brushSizeSlider.value)));
  }
  if (dom.roiAlpha) {
    dom.roiAlpha.addEventListener('input', () => setRoiAlpha(Number(dom.roiAlpha.value) / 100));
  }
  if (dom.autoResetFlood) dom.autoResetFlood.addEventListener('change', () => { S.autoResetFlood = dom.autoResetFlood.checked; });
  if (dom.showBorders) dom.showBorders.addEventListener('change', () => { S.display.showBorders = dom.showBorders.checked; dirty('overlay'); });
  if (dom.showRois) dom.showRois.addEventListener('change', () => { S.display.showRois = dom.showRois.checked; dirty('overlay'); });
  if (dom.showCells) dom.showCells.addEventListener('change', () => { S.display.showCells = dom.showCells.checked; dirty('cells'); });

  // Cells & Color controls
  if (dom.colColor) {
    dom.colColor.addEventListener('change', () => {
      S.data.colMap.color = Number(dom.colColor.value);
      dirty('cellColors', 'cells', 'ui', 'legend', 'status');
    });
  }
  if (dom.colormapSelect) {
    dom.colormapSelect.addEventListener('change', () => {
      S.display.colormap = dom.colormapSelect.value;
      dirty('cellColors', 'cells', 'legend');
    });
  }
  if (dom.clipPercentile) {
    dom.clipPercentile.addEventListener('change', () => {
      S.display.clipPercentile = dom.clipPercentile.checked;
      dirty('cellColors', 'cells', 'legend');
    });
  }
  if (dom.logScale) {
    dom.logScale.addEventListener('change', () => {
      S.display.logScale = dom.logScale.checked;
      dirty('cellColors', 'cells', 'legend');
    });
  }
  if (dom.cellSizeSlider) {
    dom.cellSizeSlider.addEventListener('input', () => {
      S.display.cellSize = Number(dom.cellSizeSlider.value);
      syncSliderFill(dom.cellSizeSlider);
      if (dom.cellSizeVal) dom.cellSizeVal.textContent = S.display.cellSize.toFixed(1) + ' px';
      dirty('cells');
    });
  }
  if (dom.cellAlphaSlider) {
    dom.cellAlphaSlider.addEventListener('input', () => {
      S.display.cellAlpha = Number(dom.cellAlphaSlider.value) / 100;
      syncSliderFill(dom.cellAlphaSlider);
      if (dom.cellAlphaVal) dom.cellAlphaVal.textContent = Math.round(S.display.cellAlpha * 100) + '%';
      dirty('cells');
    });
  }
  if (dom.yInvert) {
    dom.yInvert.addEventListener('change', () => {
      S.display.yInvert = dom.yInvert.checked;
      dirty('bg', 'cells', 'overlay', 'cursor');
    });
  }
  if (dom.bgAlphaSlider) {
    dom.bgAlphaSlider.addEventListener('input', () => {
      S.display.bgAlpha = Number(dom.bgAlphaSlider.value) / 100;
      syncSliderFill(dom.bgAlphaSlider);
      if (dom.bgAlphaVal) dom.bgAlphaVal.textContent = Math.round(S.display.bgAlpha * 100) + '%';
      dirty('bg');
    });
  }
  if (dom.bgClearBtn) {
    dom.bgClearBtn.addEventListener('click', () => {
      S.display.bgImage = null;
      S.display.bgName = '';
      refresh('bg', 'ui');
    });
  }

  // Column mapping controls
  const bindColSelect = (el, key, rebuild) => {
    if (!el) return;
    el.addEventListener('change', () => {
      const index = Number(el.value);
      if (index === S.data.colMap[key]) return;
      const colMap = { ...S.data.colMap, [key]: index };
      try {
        if (rebuild) {
          const dropped = rebuildAllChips(true, colMap);
          if (dropped) toast(droppedLabelsMessage(dropped).trim(), 4500);
        } else {
          S.data.colMap = colMap;
          refresh('ui', 'status');
        }
      } catch (err) {
        el.value = String(S.data.colMap[key]);
        toast(err.message, 4500);
      }
    });
  };
  bindColSelect(dom.colX, 'x', true);
  bindColSelect(dom.colY, 'y', true);
  bindColSelect(dom.colCellId, 'cellId', false);
  bindColSelect(dom.colWellId, 'wellId', true);
  bindColSelect(dom.colRow, 'row', true);
  bindColSelect(dom.colCol, 'col', true);
  bindColSelect(dom.colChip, 'chip', true);

  if (dom.derivedBinsSlider) {
    dom.derivedBinsSlider.addEventListener('input', () => {
      syncSliderFill(dom.derivedBinsSlider);
      if (dom.derivedBinsVal) dom.derivedBinsVal.textContent = dom.derivedBinsSlider.value;
    });
  }
  if (dom.applyGridBtn) {
    dom.applyGridBtn.addEventListener('click', () => {
      const derivedGrid = { ...S.derivedGrid, mode: 'bins', targetBins: Number(dom.derivedBinsSlider.value) };
      try {
        const dropped = rebuildAllChips(true, S.data.colMap, derivedGrid);
        toast(`Rebuilt well grid (${derivedGrid.targetBins} bins).${droppedLabelsMessage(dropped)}`, dropped ? 4500 : 2000);
      } catch (err) {
        toast(err.message, 4500);
      }
    });
  }
  if (dom.clearMetaBtn) {
    dom.clearMetaBtn.addEventListener('click', () => {
      try {
        const dropped = applyLoadedMetadata(emptySegmentMetadata());
        toast(`Cleared metadata overrides.${droppedLabelsMessage(dropped)}`, dropped ? 4500 : 2000);
      } catch (err) {
        toast(err.message, 4500);
      }
    });
  }

  // Status bar zoom buttons
  if (dom.zoomInBtn) dom.zoomInBtn.addEventListener('click', () => { zoomAtScreen(S.view.cssW * 0.5, S.view.cssH * 0.5, 1.3); dirty('bg', 'cells', 'overlay', 'cursor', 'status'); });
  if (dom.zoomOutBtn) dom.zoomOutBtn.addEventListener('click', () => { zoomAtScreen(S.view.cssW * 0.5, S.view.cssH * 0.5, 1 / 1.3); dirty('bg', 'cells', 'overlay', 'cursor', 'status'); });
  if (dom.zoomFitBtn) dom.zoomFitBtn.addEventListener('click', () => { fitViewToWells(); dirty('bg', 'cells', 'overlay', 'cursor', 'status'); });
}

function init() {
  cacheDom();
  initCellRenderer();
  syncCanvasSizes();
  bindControls();
  bindRoiListEvents();
  bindStagePointerEvents();
  bindKeyboard();
  if (dom.roiColorInput) dom.roiColorInput.value = PALETTE_20[1];

  if (typeof ResizeObserver === 'function' && dom.stage) {
    new ResizeObserver(() => {
      if (syncCanvasSizes()) dirty('bg', 'cells', 'overlay', 'cursor', 'status');
    }).observe(dom.stage);
  } else {
    window.addEventListener('resize', () => {
      if (syncCanvasSizes()) dirty('bg', 'cells', 'overlay', 'cursor', 'status');
    });
  }

  refresh('ui', 'rois', 'legend', 'status');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
