'use strict';
/* ui.js — Tool switching, pointer interaction (single click, drag brush stroke,
 * flood fill, flood erase, pan/zoom), keyboard shortcuts, ROI list rendering,
 * covariate legend/colorbar, column mapping controls, and status bar readout. */

const TOOL_META = {
  fill:        { label: 'Paint',       cursor: 'crosshair' },
  erase:       { label: 'Erase',       cursor: 'crosshair' },
  flood_fill:  { label: 'Flood fill',  cursor: 'cell' },
  flood_erase: { label: 'Flood erase', cursor: 'cell' },
  pan:         { label: 'Pan',         cursor: 'grab' },
};

const pointerState = {
  active: false,
  mode: null,        // 'pan' | 'fill' | 'erase'
  pointerId: -1,
  lastSx: 0,
  lastSy: 0,
  lastDataX: 0,
  lastDataY: 0,
  targetRoiId: 0,
  strokeDeltas: [],
  spacePan: false,
};

function setTool(toolName) {
  if (!TOOL_META[toolName]) return;
  S.tool = toolName;
  syncToolButtons();
  updateStageCursor();
  dirty('cursor', 'status');
}

function setBrushSize(size) {
  const odd = clamp((Math.round(Number(size) || 1) | 1), 1, 15);
  S.brushSize = odd;
  syncBrushUi();
  dirty('cursor', 'status');
}

function setRoiAlpha(alpha) {
  S.display.roiAlpha = clamp(Number(alpha), 0, 1);
  if (dom.roiAlpha) {
    dom.roiAlpha.value = String(Math.round(S.display.roiAlpha * 100));
    syncSliderFill(dom.roiAlpha);
  }
  if (dom.roiAlphaVal) dom.roiAlphaVal.textContent = Math.round(S.display.roiAlpha * 100) + '%';
  dirty('overlay');
}

function syncSliderFill(input) {
  if (!input) return;
  const min = Number(input.min || 0), max = Number(input.max || 100), val = Number(input.value || 0);
  const pct = max > min ? clamp(((val - min) / (max - min)) * 100, 0, 100) : 0;
  input.style.setProperty('--lg-progress', pct.toFixed(1) + '%');
}

function updateStageCursor() {
  if (!dom.stage) return;
  if (pointerState.spacePan || S.tool === 'pan') {
    dom.stage.style.cursor = pointerState.active && pointerState.mode === 'pan' ? 'grabbing' : 'grab';
  } else {
    dom.stage.style.cursor = (TOOL_META[S.tool] && TOOL_META[S.tool].cursor) || 'crosshair';
  }
}

function syncToolButtons() {
  document.querySelectorAll('#tools .tool[data-tool]').forEach(btn => {
    const on = btn.dataset.tool === S.tool;
    btn.classList.toggle('on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
}

function syncBrushUi() {
  if (dom.brushSizeSlider) {
    dom.brushSizeSlider.value = String(S.brushSize);
    syncSliderFill(dom.brushSizeSlider);
  }
  if (dom.brushSizeVal) dom.brushSizeVal.textContent = `${S.brushSize}×${S.brushSize}`;
  document.querySelectorAll('.brush-preset').forEach(btn => {
    btn.classList.toggle('on', Number(btn.dataset.size) === S.brushSize);
  });
}

function syncUndoRedoButtons() {
  const cs = activeChipState();
  if (dom.undoBtn) dom.undoBtn.disabled = !canUndo(cs);
  if (dom.redoBtn) dom.redoBtn.disabled = !canRedo(cs);
}

function syncAllControls() {
  const hasData = S.data.rowCount > 0;
  if (dom.hint) dom.hint.style.display = hasData ? 'none' : 'grid';
  if (dom.fileName) {
    dom.fileName.hidden = !hasData;
    if (hasData) {
      dom.fileName.textContent = S.data.fileName;
      dom.fileName.title = `${S.data.fileName} (${S.data.rowCount.toLocaleString()} cells)`;
    }
  }
  if (dom.groupInput && document.activeElement !== dom.groupInput) {
    dom.groupInput.value = S.group;
  }
  if (dom.autoResetFlood) dom.autoResetFlood.checked = S.autoResetFlood;
  if (dom.showBorders) dom.showBorders.checked = S.display.showBorders;
  if (dom.showRois) dom.showRois.checked = S.display.showRois;
  if (dom.showCells) dom.showCells.checked = S.display.showCells;
  if (dom.yInvert) dom.yInvert.checked = S.display.yInvert;
  if (dom.clipPercentile) dom.clipPercentile.checked = S.display.clipPercentile;
  if (dom.logScale) dom.logScale.checked = S.display.logScale;
  if (dom.colormapSelect) dom.colormapSelect.value = S.display.colormap;

  if (dom.roiAlpha) {
    dom.roiAlpha.value = String(Math.round(S.display.roiAlpha * 100));
    syncSliderFill(dom.roiAlpha);
  }
  if (dom.roiAlphaVal) dom.roiAlphaVal.textContent = Math.round(S.display.roiAlpha * 100) + '%';

  if (dom.cellSizeSlider) {
    dom.cellSizeSlider.value = String(S.display.cellSize);
    syncSliderFill(dom.cellSizeSlider);
  }
  if (dom.cellSizeVal) dom.cellSizeVal.textContent = S.display.cellSize.toFixed(1) + ' px';

  if (dom.cellAlphaSlider) {
    dom.cellAlphaSlider.value = String(Math.round(S.display.cellAlpha * 100));
    syncSliderFill(dom.cellAlphaSlider);
  }
  if (dom.cellAlphaVal) dom.cellAlphaVal.textContent = Math.round(S.display.cellAlpha * 100) + '%';

  if (dom.bgAlphaSlider) {
    dom.bgAlphaSlider.value = String(Math.round(S.display.bgAlpha * 100));
    syncSliderFill(dom.bgAlphaSlider);
  }
  if (dom.bgAlphaVal) dom.bgAlphaVal.textContent = Math.round(S.display.bgAlpha * 100) + '%';
  if (dom.bgClearBtn) dom.bgClearBtn.disabled = !S.display.bgImage;
  if (dom.bgInfo) dom.bgInfo.textContent = S.display.bgImage ? S.display.bgName : 'None loaded';

  // Enable/disable export/import actions
  [dom.exportCsvBtn, dom.exportSummaryBtn, dom.saveSessionBtn, dom.exportCsvBtn2, dom.exportSummaryBtn2, dom.saveSessionBtn2, dom.clearSegBtn]
    .forEach(btn => { if (btn) btn.disabled = !hasData; });

  // Chip selector visibility
  if (dom.chipRow && dom.chipSelect) {
    const multi = S.chips.list.length > 1;
    dom.chipRow.hidden = !multi;
    if (multi) {
      dom.chipSelect.innerHTML = S.chips.list.map(c =>
        `<option value="${escHtml(c)}"${c === S.chips.active ? ' selected' : ''}>Chip ${escHtml(c)} (${(S.chips.cellIndicesByChip.get(c) || []).length.toLocaleString()} cells)</option>`
      ).join('');
    }
  }

  // Numeric colormap options visibility
  const colorCol = S.data.colMap.color >= 0 ? S.data.columns[S.data.colMap.color] : null;
  if (dom.numericColorOpts) dom.numericColorOpts.hidden = !(colorCol && colorCol.kind === 'number');

  // Derived grid controls visibility
  const cs = activeChipState();
  if (dom.gridInfo) {
    if (!cs) {
      dom.gridInfo.textContent = 'No dataset loaded.';
    } else {
      const w = cs.wells;
      const modeText = w.mode === 'array' ? 'Chip array metadata' : (w.mode === 'explicit' ? 'Explicit well columns' : 'Derived from X/Y');
      dom.gridInfo.textContent = `${modeText}: ${w.nRows} × ${w.nCols} (${w.count.toLocaleString()} wells, pitch ${w.pitchX.toFixed(1)})`;
    }
  }
  if (dom.derivedGridRow) {
    dom.derivedGridRow.hidden = !(cs && cs.wells.mode === 'derived');
    if (dom.derivedBinsSlider) {
      dom.derivedBinsSlider.value = String(S.derivedGrid.targetBins);
      syncSliderFill(dom.derivedBinsSlider);
    }
    if (dom.derivedBinsVal) dom.derivedBinsVal.textContent = String(S.derivedGrid.targetBins);
  }
  if (dom.metaInfo) {
    if (S.meta.fileName) {
      const nColors = Object.keys(S.meta.flatColors).length +
        Object.values(S.meta.colorsByCol).reduce((acc, m) => acc + Object.keys(m).length, 0);
      const arrNote = S.meta.array ? ` · ${S.meta.array.arr_shape[0]}×${S.meta.array.arr_shape[1]} array` : '';
      dom.metaInfo.textContent = `${S.meta.fileName} (${nColors} colors${arrNote})`;
    } else {
      dom.metaInfo.textContent = 'Optional: JSON or value,color CSV/TSV';
    }
  }

  syncToolButtons();
  syncBrushUi();
  syncUndoRedoButtons();
}

function populateColumnSelects() {
  const headers = S.data.headers;
  const cols = S.data.columns;
  const cm = S.data.colMap;

  const fillSelect = (sel, selectedIdx, opts = {}) => {
    if (!sel) return;
    let html = opts.allowNone ? `<option value="-1">${escHtml(opts.noneLabel || '(None)')}</option>` : '';
    for (let i = 0; i < headers.length; i++) {
      if (opts.numericOnly && cols[i].kind !== 'number') continue;
      const tag = cols[i].kind === 'number' ? 'num' : (cols[i].kind === 'category' ? `${cols[i].categories.length} cats` : 'text');
      html += `<option value="${i}"${i === selectedIdx ? ' selected' : ''}>${escHtml(headers[i])} (${tag})</option>`;
    }
    sel.innerHTML = html;
  };

  fillSelect(dom.colColor, cm.color, { allowNone: true, noneLabel: '(Uniform color)' });
  fillSelect(dom.colX, cm.x, { numericOnly: true });
  fillSelect(dom.colY, cm.y, { numericOnly: true });
  fillSelect(dom.colCellId, cm.cellId, { allowNone: true, noneLabel: '(Auto row index)' });
  fillSelect(dom.colWellId, cm.wellId, { allowNone: true, noneLabel: '(Derive from X/Y)' });
  fillSelect(dom.colRow, cm.row, { allowNone: true, noneLabel: '(None)', numericOnly: true });
  fillSelect(dom.colCol, cm.col, { allowNone: true, noneLabel: '(None)', numericOnly: true });
  fillSelect(dom.colChip, cm.chip, { allowNone: true, noneLabel: '(Single chip)' });
}

function renderRoiList() {
  const wrap = dom.roiList;
  if (!wrap) return;
  const cs = activeChipState();
  if (!cs) {
    wrap.innerHTML = '<div class="empty-list">Load a cell table to create ROIs.</div>';
    if (dom.segTotals) dom.segTotals.textContent = '';
    syncUndoRedoButtons();
    return;
  }
  if (cs.rois.length === 0) {
    wrap.innerHTML = '<div class="empty-list">No ROIs yet. Add one above or paint to create ROI 1.</div>';
  } else {
    let html = '';
    for (let i = 0; i < cs.rois.length; i++) {
      const r = cs.rois[i];
      const active = r.id === cs.activeRoiId;
      html += `
        <div class="roi-item${active ? ' on' : ''}" data-roi-id="${r.id}">
          <input type="color" class="roi-swatch" value="${escHtml(r.color)}" title="Change ROI color" aria-label="Color for ${escHtml(r.name)}">
          <div class="roi-main">
            <div class="roi-name" title="${escHtml(r.name)}">${escHtml(r.name)}</div>
            <div class="roi-counts">${r.wellCount.toLocaleString()} wells · ${r.cellCount.toLocaleString()} cells</div>
          </div>
          <button type="button" class="icon-btn roi-rename" title="Rename ROI" aria-label="Rename ${escHtml(r.name)}">✎</button>
          <button type="button" class="icon-btn roi-del" title="Delete ROI" aria-label="Delete ${escHtml(r.name)}">×</button>
        </div>`;
    }
    wrap.innerHTML = html;
  }

  let totalWells = 0, totalCells = 0;
  for (let i = 0; i < cs.rois.length; i++) {
    totalWells += cs.rois[i].wellCount;
    totalCells += cs.rois[i].cellCount;
  }
  if (dom.segTotals) {
    const totalChipCells = cs.wells.xs.length;
    const pct = totalChipCells > 0 ? ((totalCells / totalChipCells) * 100).toFixed(1) : '0.0';
    dom.segTotals.textContent = `${totalWells.toLocaleString()} / ${cs.wells.count.toLocaleString()} wells · ${totalCells.toLocaleString()} cells (${pct}%)`;
  }
  syncUndoRedoButtons();
}

function renderLegend() {
  const wrap = dom.colorLegend;
  if (!wrap) return;
  const leg = S.cellColors.legend;
  if (!leg || leg.kind === 'none') {
    wrap.innerHTML = '<div class="note">Select a covariate column to color cells.</div>';
    return;
  }
  if (leg.kind === 'number') {
    const stops = COLORMAP_STOPS[leg.colormap] || COLORMAP_STOPS.viridis;
    const grad = stops.map(s => `rgb(${s[0]},${s[1]},${s[2]})`).join(', ');
    const fmt = v => Math.abs(v) >= 1000 ? v.toFixed(0) : (Math.abs(v) < 0.01 && v !== 0 ? v.toExponential(1) : Number(v.toPrecision(3)).toString());
    wrap.innerHTML = `
      <div class="cbar-label">${escHtml(leg.colName)}${leg.log ? ' (log1p)' : ''}</div>
      <div class="cbar-bar" style="background:linear-gradient(90deg, ${grad})"></div>
      <div class="cbar-ticks"><span>${escHtml(fmt(leg.min))}</span><span>${escHtml(fmt(leg.max))}</span></div>
    `;
    return;
  }
  // Categorical legend (show up to 40 items cleanly, with summary if more)
  const maxShow = 40;
  let html = `<div class="legend-grid">`;
  const lim = Math.min(leg.items.length, maxShow);
  for (let i = 0; i < lim; i++) {
    const it = leg.items[i];
    html += `<div class="legend-item" title="${escHtml(it.label)} (${it.count.toLocaleString()} cells)">
      <span class="legend-dot" style="background:${escHtml(it.color)}"></span>
      <span class="legend-name">${escHtml(it.label)}</span>
      <span class="legend-cnt">${it.count.toLocaleString()}</span>
    </div>`;
  }
  html += `</div>`;
  if (leg.items.length > maxShow) {
    html += `<div class="note">+ ${(leg.items.length - maxShow).toLocaleString()} more categories</div>`;
  }
  wrap.innerHTML = html;
}

function renderStatus() {
  const cs = activeChipState();
  if (!dom.statusText) return;
  if (!cs) {
    dom.statusText.textContent = `Ready · Renderer: ${S.renderer === 'webgl' ? 'GPU' : 'software'}`;
    if (dom.zoomLabel) dom.zoomLabel.textContent = '100%';
    return;
  }
  const w = cs.wells;
  const parts = [
    `${w.xs.length.toLocaleString()} cells`,
    `${w.count.toLocaleString()} wells (${w.nRows}×${w.nCols})`,
    S.renderer === 'webgl' ? 'GPU' : 'software',
  ];
  if (S.hover.inside && S.hover.wellIdx >= 0) {
    const wi = S.hover.wellIdx;
    const rid = cs.wellRoi[wi];
    const roi = rid > 0 ? cs.roiById.get(rid) : null;
    parts.push(`Well ${w.wellIds[wi]} (r${w.row[wi]}, c${w.col[wi]}) · ${w.wellCellCount[wi]} cells · ROI: ${roi ? roi.name : '—'}`);
    if (S.hover.cellIdx >= 0 && S.data.colMap.color >= 0) {
      const chipCells = activeChipCells();
      const rowIdx = chipCells ? chipCells[S.hover.cellIdx] : -1;
      if (rowIdx >= 0) {
        const col = S.data.columns[S.data.colMap.color];
        parts.push(`${col.name}: ${getColumnString(col, rowIdx) || 'NA'}`);
      }
    }
  }
  dom.statusText.textContent = parts.join('  ·  ');
  if (dom.zoomLabel) {
    const baseSpan = Math.max(1e-3, w.maxX - w.minX, w.maxY - w.minY);
    const fitScale = (Math.min(S.view.cssW, S.view.cssH) * 0.9) / baseSpan;
    const pct = fitScale > 0 ? Math.round((S.view.scale / fitScale) * 100) : 100;
    dom.zoomLabel.textContent = pct + '%';
  }
}

/* ---- Stage Pointer Interaction ---- */
function stageCoords(e) {
  const r = dom.stage.getBoundingClientRect();
  return { sx: e.clientX - r.left, sy: e.clientY - r.top };
}

function wellAtDataPoint(cs, x, y) {
  if (!cs) return -1;
  const w = cs.wells;
  const padX = w.pitchX * 0.75, padY = w.pitchY * 0.75;
  if (x < w.minX - padX || x > w.maxX + padX || y < w.minY - padY || y > w.maxY + padY) return -1;
  return w.spatial.closest(x, y);
}

function finishStagePointer(pointerId = pointerState.pointerId) {
  if (!pointerState.active || pointerId !== pointerState.pointerId) return;
  const cs = activeChipState();
  const wasMode = pointerState.mode;
  const deltas = pointerState.strokeDeltas;
  const roiId = pointerState.targetRoiId;
  pointerState.active = false;
  pointerState.mode = null;
  pointerState.pointerId = -1;
  pointerState.strokeDeltas = [];
  try { if (dom.stage.hasPointerCapture(pointerId)) dom.stage.releasePointerCapture(pointerId); } catch {}
  updateStageCursor();

  if (cs && (wasMode === 'fill' || wasMode === 'erase') && deltas.length > 0) {
    const merged = mergeStrokeDeltas(deltas);
    if (merged) {
      const roi = roiId > 0 ? cs.roiById.get(roiId) : null;
      pushHistory(cs, {
        label: wasMode === 'fill'
          ? `Paint "${roi ? roi.name : 'ROI'}" (${merged.wellIdx.length} wells)`
          : `Erase (${merged.wellIdx.length} wells)`,
        delta: merged,
        roisBefore: null,
        roisAfter: null,
        activeBefore: cs.activeRoiId,
        activeAfter: cs.activeRoiId,
      });
      syncUndoRedoButtons();
    }
  }
}

function bindStagePointerEvents() {
  const stage = dom.stage;
  if (!stage) return;

  stage.addEventListener('pointerdown', e => {
    const cs = activeChipState();
    if (!cs) return;
    // Middle or right mouse button, Space-drag, or Pan tool -> pan
    const isPan = e.button === 1 || e.button === 2 || pointerState.spacePan || S.tool === 'pan';
    if (e.button !== 0 && !isPan) return;
    e.preventDefault();
    const { sx, sy } = stageCoords(e);
    const dp = screenToData(sx, sy);

    if (isPan) {
      pointerState.active = true;
      pointerState.mode = 'pan';
      pointerState.pointerId = e.pointerId;
      pointerState.lastSx = sx;
      pointerState.lastSy = sy;
      stage.setPointerCapture(e.pointerId);
      updateStageCursor();
      return;
    }

    const wIdx = wellAtDataPoint(cs, dp.x, dp.y);
    if (wIdx < 0) return;

    if (S.tool === 'flood_fill' || S.tool === 'flood_erase') {
      const changed = runFloodAction(cs, wIdx, S.tool);
      if (S.autoResetFlood) {
        setTool(S.tool === 'flood_fill' ? 'fill' : 'erase');
      }
      if (changed > 0) {
        dirty('overlay', 'rois', 'status');
      } else if (S.tool === 'flood_erase') {
        toast('Click a painted well to flood erase its connected ROI.');
      }
      return;
    }

    // Individual Fill or Dedicated Erase (supports single click AND drag!)
    let targetRoiId = 0;
    if (S.tool === 'fill') {
      const roi = ensureActiveRoi(cs);
      targetRoiId = roi.id;
    }
    pointerState.active = true;
    pointerState.mode = S.tool;
    pointerState.pointerId = e.pointerId;
    pointerState.lastSx = sx;
    pointerState.lastSy = sy;
    pointerState.lastDataX = dp.x;
    pointerState.lastDataY = dp.y;
    pointerState.targetRoiId = targetRoiId;
    pointerState.strokeDeltas = [];
    stage.setPointerCapture(e.pointerId);

    const brush = getBrushWells(cs.wells, wIdx, S.brushSize);
    const delta = applyWellAssignments(cs, brush, targetRoiId);
    if (delta) pointerState.strokeDeltas.push(delta);
    dirty('overlay', 'rois', 'cursor', 'status');
  });

  stage.addEventListener('pointermove', e => {
    const cs = activeChipState();
    if (!cs) return;
    const { sx, sy } = stageCoords(e);

    if (pointerState.active && pointerState.mode === 'pan') {
      const dx = sx - pointerState.lastSx;
      const dy = sy - pointerState.lastSy;
      pointerState.lastSx = sx;
      pointerState.lastSy = sy;
      S.view.cx -= dx / S.view.scale;
      S.view.cy -= dy / (S.view.scale * ySign());
      dirty('bg', 'cells', 'overlay', 'cursor', 'status');
      return;
    }

    const dp = screenToData(sx, sy);
    const wIdx = wellAtDataPoint(cs, dp.x, dp.y);
    S.hover.inside = true;
    S.hover.dataX = dp.x;
    S.hover.dataY = dp.y;
    S.hover.wellIdx = wIdx;
    S.hover.cellIdx = wIdx >= 0 ? cs.wells.cellSpatial.closestWithin(dp.x, dp.y, Math.max(cs.wells.pitchX, cs.wells.pitchY) * 0.7) : -1;

    if (pointerState.active && (pointerState.mode === 'fill' || pointerState.mode === 'erase')) {
      const stroke = getStrokeWells(cs.wells, pointerState.lastDataX, pointerState.lastDataY, dp.x, dp.y, S.brushSize);
      pointerState.lastDataX = dp.x;
      pointerState.lastDataY = dp.y;
      const delta = applyWellAssignments(cs, stroke, pointerState.targetRoiId);
      if (delta) {
        pointerState.strokeDeltas.push(delta);
        dirty('overlay', 'rois');
      }
    }
    dirty('cursor', 'status');
  });

  stage.addEventListener('pointerup', e => finishStagePointer(e.pointerId));
  stage.addEventListener('pointercancel', e => finishStagePointer(e.pointerId));
  stage.addEventListener('pointerleave', () => {
    S.hover.inside = false;
    S.hover.wellIdx = -1;
    S.hover.cellIdx = -1;
    dirty('cursor', 'status');
  });
  stage.addEventListener('contextmenu', e => e.preventDefault());

  stage.addEventListener('wheel', e => {
    const cs = activeChipState();
    if (!cs) return;
    e.preventDefault();
    const { sx, sy } = stageCoords(e);
    const factor = e.deltaY < 0 ? 1.15 : (1 / 1.15);
    zoomAtScreen(sx, sy, factor);
    dirty('bg', 'cells', 'overlay', 'cursor', 'status');
  }, { passive: false });
}

/* ---- Keyboard Shortcuts ---- */
function bindKeyboard() {
  window.addEventListener('keydown', e => {
    const tag = e.target && e.target.tagName;
    const inText = tag === 'INPUT' && !['range', 'checkbox', 'color'].includes(e.target.type) || tag === 'TEXTAREA' || tag === 'SELECT';

    if (e.key === 'Escape') {
      if (dom.helpOverlay && dom.helpOverlay.style.display === 'flex') {
        dom.helpOverlay.style.display = 'none';
        return;
      }
      if (inText) e.target.blur();
      return;
    }

    if ((e.metaKey || e.ctrlKey) && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === 'z') {
        if (inText) return;
        e.preventDefault();
        const cs = activeChipState();
        if (!cs) return;
        const entry = e.shiftKey ? redoSeg(cs) : undoSeg(cs);
        if (entry) {
          toast((e.shiftKey ? 'Redid: ' : 'Undid: ') + entry.label, 1800);
          dirty('overlay', 'rois', 'status');
        }
        return;
      }
      if (k === 'y') {
        if (inText) return;
        e.preventDefault();
        const cs = activeChipState();
        const entry = cs && redoSeg(cs);
        if (entry) { toast('Redid: ' + entry.label, 1800); dirty('overlay', 'rois', 'status'); }
        return;
      }
      if (k === 's') {
        e.preventDefault();
        if (S.data.rowCount > 0) saveSessionAction();
        return;
      }
      if (k === 'e') {
        e.preventDefault();
        if (S.data.rowCount > 0) exportCsvAction();
        return;
      }
      if (k === 'o') {
        e.preventDefault();
        if (dom.fileInput) dom.fileInput.click();
        return;
      }
    }

    if (inText || e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (!pointerState.spacePan) { pointerState.spacePan = true; updateStageCursor(); }
      return;
    }

    const k = e.key.toLowerCase();
    if (k === 'b' || k === 'p') setTool('fill');
    else if (k === 'e') setTool('erase');
    else if (k === 'g') setTool('flood_fill');
    else if (k === 'x') setTool('flood_erase');
    else if (k === 'h') setTool('pan');
    else if (k === '[') setBrushSize(Math.max(1, S.brushSize - 2));
    else if (k === ']') setBrushSize(Math.min(15, S.brushSize + 2));
    else if (k === 'f' || k === '0') { fitViewToWells(); dirty('bg', 'cells', 'overlay', 'cursor', 'status'); }
    else if (k === '+' || k === '=') { zoomAtScreen(S.view.cssW * 0.5, S.view.cssH * 0.5, 1.25); dirty('bg', 'cells', 'overlay', 'cursor', 'status'); }
    else if (k === '-') { zoomAtScreen(S.view.cssW * 0.5, S.view.cssH * 0.5, 0.8); dirty('bg', 'cells', 'overlay', 'cursor', 'status'); }
    else if (e.key === '?') {
      if (dom.helpOverlay) dom.helpOverlay.style.display = dom.helpOverlay.style.display === 'flex' ? 'none' : 'flex';
    }
  });

  window.addEventListener('keyup', e => {
    if (e.code === 'Space' && pointerState.spacePan) {
      pointerState.spacePan = false;
      updateStageCursor();
    }
  });
}

/* ---- Inline ROI Rename & List Click Delegation ---- */
function bindRoiListEvents() {
  if (!dom.roiList) return;
  dom.roiList.addEventListener('click', e => {
    const cs = activeChipState();
    if (!cs) return;
    const item = e.target.closest('.roi-item');
    if (!item) return;
    const roiId = Number(item.dataset.roiId);
    if (e.target.closest('.roi-swatch')) return;

    if (e.target.closest('.roi-del')) {
      const roi = cs.roiById.get(roiId);
      if (roi && deleteRoi(cs, roiId)) {
        toast(`Deleted ROI "${roi.name}"`, 2000);
        dirty('overlay', 'rois', 'status');
      }
      return;
    }
    if (e.target.closest('.roi-rename')) {
      startInlineRoiRename(item, roiId);
      return;
    }
    cs.activeRoiId = roiId;
    if (S.tool === 'erase' || S.tool === 'flood_erase') setTool('fill');
    dirty('rois', 'status');
  });

  dom.roiList.addEventListener('dblclick', e => {
    const item = e.target.closest('.roi-item');
    if (!item || e.target.closest('button') || e.target.closest('input')) return;
    startInlineRoiRename(item, Number(item.dataset.roiId));
  });

  dom.roiList.addEventListener('input', e => {
    if (!e.target.classList.contains('roi-swatch')) return;
    const cs = activeChipState();
    const item = e.target.closest('.roi-item');
    if (!cs || !item) return;
    const roi = cs.roiById.get(Number(item.dataset.roiId));
    if (!roi) return;
    if (!e.target.dataset.origColor) e.target.dataset.origColor = roi.color;
    roi.color = normalizeHexColor(e.target.value, roi.color);
    roi.rgb = parseColorToRgb(roi.color) || roi.rgb;
    cs.roiMapDirty = true;
    dirty('overlay');
  });

  dom.roiList.addEventListener('change', e => {
    if (!e.target.classList.contains('roi-swatch')) return;
    const cs = activeChipState();
    const item = e.target.closest('.roi-item');
    if (!cs || !item) return;
    const roi = cs.roiById.get(Number(item.dataset.roiId));
    if (!roi) return;
    const orig = e.target.dataset.origColor;
    delete e.target.dataset.origColor;
    if (orig) {
      roi.color = orig;
      roi.rgb = parseColorToRgb(orig) || roi.rgb;
    }
    recolorRoi(cs, Number(item.dataset.roiId), e.target.value);
    dirty('overlay', 'rois');
  });
}

function startInlineRoiRename(itemEl, roiId) {
  const cs = activeChipState();
  const roi = cs && cs.roiById.get(roiId);
  if (!roi) return;
  const nameEl = itemEl.querySelector('.roi-name');
  if (!nameEl || nameEl.querySelector('input')) return;

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'roi-rename-input';
  input.value = roi.name;
  nameEl.textContent = '';
  nameEl.appendChild(input);
  input.focus();
  input.select();

  let done = false;
  const finish = commit => {
    if (done) return;
    done = true;
    if (commit) {
      try {
        if (renameRoi(cs, roiId, input.value)) toast(`Renamed ROI to "${input.value.trim()}"`, 1800);
      } catch (err) {
        toast(err.message, 3200);
      }
    }
    dirty('rois', 'status');
  };
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter') { ev.preventDefault(); finish(true); }
    else if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
  });
  input.addEventListener('blur', () => finish(true));
}
