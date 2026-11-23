'use strict';
/* seg.js — Core segmentation operations ported from survey/spatial/segment.py:
 * ROI CRUD (create / rename / recolor / delete), variable-size brush & stroke interpolation,
 * fill_selected (including re-assigning wells from another ROI), erase_selected (dedicated Erase),
 * 4-connected flood fill (empty-space fill + flood-convert) and flood erase (same-ROI only),
 * plus compact delta Undo/Redo history. */

const MAX_HISTORY = 200;

function createChipSegState(wells) {
  return {
    wells,
    rois: [],                         // [{ id, name, color, rgb:[r,g,b], wellCount, cellCount }]
    roiById: new Map(),               // roiId -> roi object
    nextRoiId: 1,
    activeRoiId: 0,
    wellRoi: new Uint16Array(wells.count), // 0 = unassigned, >0 = roiId
    history: {
      entries: [],
      index: -1,
    },
    roiMapCanvas: null,               // Offscreen nCols x nRows pixel buffer for ultra-fast zoomed-out overlay
    roiMapDirty: true,
  };
}

function cloneRoiList(rois) {
  return rois.map(r => ({ id: r.id, name: r.name, color: r.color, rgb: [r.rgb[0], r.rgb[1], r.rgb[2]] }));
}

function getNextRoiColor(chipState) {
  const used = new Set(chipState.rois.map(r => r.color.toLowerCase()));
  for (let i = 0; i < PALETTE_20.length; i++) {
    if (!used.has(PALETTE_20[i].toLowerCase())) return PALETTE_20[i];
  }
  return PALETTE_20[chipState.rois.length % PALETTE_20.length];
}

function recountRois(chipState) {
  const { rois, roiById, wellRoi, wells } = chipState;
  roiById.clear();
  for (let i = 0; i < rois.length; i++) {
    rois[i].wellCount = 0;
    rois[i].cellCount = 0;
    roiById.set(rois[i].id, rois[i]);
  }
  const cellCounts = wells.wellCellCount;
  for (let w = 0; w < wellRoi.length; w++) {
    const rid = wellRoi[w];
    if (rid > 0) {
      const r = roiById.get(rid);
      if (r) {
        r.wellCount++;
        r.cellCount += cellCounts[w];
      }
    }
  }
}

function pushHistory(chipState, entry) {
  const h = chipState.history;
  if (h.index < h.entries.length - 1) {
    h.entries.length = h.index + 1;
  }
  h.entries.push(entry);
  if (h.entries.length > MAX_HISTORY) {
    h.entries.shift();
  }
  h.index = h.entries.length - 1;
}

function canUndo(chipState) {
  return Boolean(chipState && chipState.history.index >= 0);
}

function canRedo(chipState) {
  return Boolean(chipState && chipState.history.index < chipState.history.entries.length - 1);
}

function createRoi(chipState, name, color, recordHistory = true) {
  const trimmed = String(name || '').trim();
  if (!trimmed) throw new Error('ROI name cannot be empty.');
  if (chipState.rois.some(r => r.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error(`An ROI named "${trimmed}" already exists.`);
  }
  const roisBefore = recordHistory ? cloneRoiList(chipState.rois) : null;
  const activeBefore = chipState.activeRoiId;
  const hex = normalizeHexColor(color || getNextRoiColor(chipState), getNextRoiColor(chipState));
  const rgb = parseColorToRgb(hex) || [88, 216, 245];
  const roi = {
    id: chipState.nextRoiId++,
    name: trimmed,
    color: hex,
    rgb,
    wellCount: 0,
    cellCount: 0,
  };
  chipState.rois.push(roi);
  chipState.roiById.set(roi.id, roi);
  chipState.activeRoiId = roi.id;
  if (recordHistory) {
    pushHistory(chipState, {
      label: `Add ROI "${trimmed}"`,
      delta: null,
      roisBefore,
      roisAfter: cloneRoiList(chipState.rois),
      activeBefore,
      activeAfter: chipState.activeRoiId,
    });
  }
  return roi;
}

function ensureActiveRoi(chipState) {
  if (chipState.activeRoiId && chipState.roiById.has(chipState.activeRoiId)) {
    return chipState.roiById.get(chipState.activeRoiId);
  }
  if (chipState.rois.length > 0) {
    chipState.activeRoiId = chipState.rois[0].id;
    return chipState.rois[0];
  }
  return createRoi(chipState, 'ROI 1', null, true);
}

function renameRoi(chipState, roiId, newName) {
  const roi = chipState.roiById.get(roiId);
  if (!roi) return false;
  const trimmed = String(newName || '').trim();
  if (!trimmed || trimmed === roi.name) return false;
  if (chipState.rois.some(r => r.id !== roiId && r.name.toLowerCase() === trimmed.toLowerCase())) {
    throw new Error(`An ROI named "${trimmed}" already exists.`);
  }
  const roisBefore = cloneRoiList(chipState.rois);
  const prevName = roi.name;
  roi.name = trimmed;
  pushHistory(chipState, {
    label: `Rename "${prevName}" → "${trimmed}"`,
    delta: null,
    roisBefore,
    roisAfter: cloneRoiList(chipState.rois),
    activeBefore: chipState.activeRoiId,
    activeAfter: chipState.activeRoiId,
  });
  return true;
}

function recolorRoi(chipState, roiId, newColor) {
  const roi = chipState.roiById.get(roiId);
  if (!roi) return false;
  const hex = normalizeHexColor(newColor, roi.color);
  if (hex.toLowerCase() === roi.color.toLowerCase()) return false;
  const roisBefore = cloneRoiList(chipState.rois);
  roi.color = hex;
  roi.rgb = parseColorToRgb(hex) || roi.rgb;
  chipState.roiMapDirty = true;
  pushHistory(chipState, {
    label: `Recolor "${roi.name}"`,
    delta: null,
    roisBefore,
    roisAfter: cloneRoiList(chipState.rois),
    activeBefore: chipState.activeRoiId,
    activeAfter: chipState.activeRoiId,
  });
  return true;
}

function deleteRoi(chipState, roiId) {
  const idx = chipState.rois.findIndex(r => r.id === roiId);
  if (idx === -1) return false;
  const roi = chipState.rois[idx];
  const roisBefore = cloneRoiList(chipState.rois);
  const activeBefore = chipState.activeRoiId;

  const changedWells = [];
  const wellRoi = chipState.wellRoi;
  for (let w = 0; w < wellRoi.length; w++) {
    if (wellRoi[w] === roiId) {
      changedWells.push(w);
      wellRoi[w] = 0;
    }
  }
  const delta = changedWells.length > 0 ? {
    wellIdx: Int32Array.from(changedWells),
    prev: new Uint16Array(changedWells.length).fill(roiId),
    next: new Uint16Array(changedWells.length), // all 0
  } : null;

  chipState.rois.splice(idx, 1);
  chipState.roiById.delete(roiId);
  if (chipState.activeRoiId === roiId) {
    chipState.activeRoiId = chipState.rois.length > 0 ? chipState.rois[Math.min(idx, chipState.rois.length - 1)].id : 0;
  }
  chipState.roiMapDirty = true;
  pushHistory(chipState, {
    label: `Delete ROI "${roi.name}"`,
    delta,
    roisBefore,
    roisAfter: cloneRoiList(chipState.rois),
    activeBefore,
    activeAfter: chipState.activeRoiId,
  });
  return true;
}

/** Return well indices inside the k×k brush centered at centerWellIdx (k = odd integer >= 1). */
function getBrushWells(wells, centerWellIdx, brushSize) {
  if (centerWellIdx < 0 || centerWellIdx >= wells.count) return [];
  const k = Math.max(1, Math.round(brushSize || 1));
  if (k <= 1) return [centerWellIdx];
  const half = Math.floor(k / 2);
  const r0 = wells.row[centerWellIdx];
  const c0 = wells.col[centerWellIdx];
  const nR = wells.nRows, nC = wells.nCols, g2w = wells.gridToWell;
  const rLo = Math.max(0, r0 - half), rHi = Math.min(nR - 1, r0 + half);
  const cLo = Math.max(0, c0 - half), cHi = Math.min(nC - 1, c0 + half);
  const out = [];
  for (let rr = rLo; rr <= rHi; rr++) {
    const base = rr * nC;
    for (let cc = cLo; cc <= cHi; cc++) {
      const wIdx = g2w[base + cc];
      if (wIdx >= 0) out.push(wIdx);
    }
  }
  // Inferred grids can put multiple centers in one slot.
  if (g2w[r0 * nC + c0] !== centerWellIdx) out.push(centerWellIdx);
  return out;
}

/** Interpolate segment (x0,y0)->(x1,y1) so fast pointer drags never skip wells. */
function getStrokeWells(wells, x0, y0, x1, y1, brushSize) {
  const dx = x1 - x0, dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const step = Math.max(1e-6, Math.min(wells.pitchX, wells.pitchY) * 0.35);
  const nSteps = Math.max(1, Math.ceil(dist / step));
  const out = [];
  const seen = new Set();
  for (let s = 0; s <= nSteps; s++) {
    const t = s / nSteps;
    const wCenter = wells.spatial.closest(x0 + dx * t, y0 + dy * t);
    if (wCenter < 0) continue;
    const brush = getBrushWells(wells, wCenter, brushSize);
    for (let i = 0; i < brush.length; i++) {
      const w = brush[i];
      if (!seen.has(w)) { seen.add(w); out.push(w); }
    }
  }
  return out;
}

/**
 * Apply targetRoiId (0 = erase, >0 = assign/reassign) to wellIndices in place.
 * Updates per-ROI wellCount and cellCount in O(changed).
 * Returns compact delta or null if nothing changed.
 */
function applyWellAssignments(chipState, wellIndices, targetRoiId) {
  const wellRoi = chipState.wellRoi;
  const cellCounts = chipState.wells.wellCellCount;
  const roiById = chipState.roiById;
  const targetRoi = targetRoiId > 0 ? roiById.get(targetRoiId) : null;
  if (targetRoiId > 0 && !targetRoi) return null;

  const changedIdx = [];
  const changedPrev = [];
  for (let i = 0; i < wellIndices.length; i++) {
    const w = wellIndices[i];
    if (w < 0 || w >= wellRoi.length) continue;
    const prev = wellRoi[w];
    if (prev === targetRoiId) continue;
    wellRoi[w] = targetRoiId;
    const cc = cellCounts[w];
    if (prev > 0) {
      const prevRoi = roiById.get(prev);
      if (prevRoi) { prevRoi.wellCount--; prevRoi.cellCount -= cc; }
    }
    if (targetRoi) {
      targetRoi.wellCount++;
      targetRoi.cellCount += cc;
    }
    changedIdx.push(w);
    changedPrev.push(prev);
  }
  if (changedIdx.length === 0) return null;
  chipState.roiMapDirty = true;
  const next = new Uint16Array(changedIdx.length);
  next.fill(targetRoiId);
  return {
    wellIdx: Int32Array.from(changedIdx),
    prev: Uint16Array.from(changedPrev),
    next,
  };
}

/** Merge incremental stroke deltas into one atomic Undo entry on pointerup. */
function mergeStrokeDeltas(deltas) {
  if (!deltas || deltas.length === 0) return null;
  if (deltas.length === 1) return deltas[0];
  const firstPrev = new Map();
  const lastNext = new Map();
  for (let d = 0; d < deltas.length; d++) {
    const { wellIdx, prev, next } = deltas[d];
    for (let i = 0; i < wellIdx.length; i++) {
      const w = wellIdx[i];
      if (!firstPrev.has(w)) firstPrev.set(w, prev[i]);
      lastNext.set(w, next[i]);
    }
  }
  const idx = [], pArr = [], nArr = [];
  for (const [w, p] of firstPrev.entries()) {
    const n = lastNext.get(w);
    if (p !== n) { idx.push(w); pArr.push(p); nArr.push(n); }
  }
  if (idx.length === 0) return null;
  return {
    wellIdx: Int32Array.from(idx),
    prev: Uint16Array.from(pArr),
    next: Uint16Array.from(nArr),
  };
}

/**
 * Exact 4-connected (connectivity=1) flood search matching segment.py lines 574-630:
 *  - mode === 'flood_erase': if seed well has ROI R > 0, finds all 4-connected wells with wellRoi === R.
 *    If seed well is unassigned (0), returns [] (no-op).
 *  - mode === 'flood_fill':
 *    - If seed well is unassigned (0): finds all 4-connected unassigned wells (existing ROIs act as barriers).
 *    - If seed well has ROI R > 0: Flood Convert! If R === activeRoiId, returns []; else finds all 4-connected wells with wellRoi === R.
 */
function computeFloodWells(chipState, seedWellIdx, mode, activeRoiId) {
  const { wells, wellRoi } = chipState;
  if (seedWellIdx < 0 || seedWellIdx >= wells.count) return [];
  const seedRoi = wellRoi[seedWellIdx];

  if (mode === 'flood_erase') {
    if (seedRoi === 0) return [];
  } else if (mode === 'flood_fill') {
    if (!activeRoiId || !chipState.roiById.has(activeRoiId)) return [];
    if (seedRoi === activeRoiId) return [];
  } else {
    return [];
  }

  const targetMatch = seedRoi; // 0 for empty-space flood fill; >0 for flood erase or flood convert
  const nR = wells.nRows, nC = wells.nCols, g2w = wells.gridToWell;
  const totalGrid = nR * nC;
  const visited = new Uint8Array(totalGrid);
  const queue = new Int32Array(totalGrid);
  let head = 0, tail = 0;

  const r0 = wells.row[seedWellIdx];
  const c0 = wells.col[seedWellIdx];
  const g0 = r0 * nC + c0;
  visited[g0] = 1;
  queue[tail++] = g0;
  const result = [];

  while (head < tail) {
    const g = queue[head++];
    result.push(g === g0 ? seedWellIdx : g2w[g]);
    const rr = (g / nC) | 0;
    const cc = g - rr * nC;

    // 4-connected neighbors (up, down, left, right), matching skimage.morphology.flood_fill(..., connectivity=1)
    if (rr > 0) {
      const ng = g - nC;
      if (!visited[ng]) {
        const nw = g2w[ng];
        if (nw >= 0 && wellRoi[nw] === targetMatch) { visited[ng] = 1; queue[tail++] = ng; }
      }
    }
    if (rr + 1 < nR) {
      const ng = g + nC;
      if (!visited[ng]) {
        const nw = g2w[ng];
        if (nw >= 0 && wellRoi[nw] === targetMatch) { visited[ng] = 1; queue[tail++] = ng; }
      }
    }
    if (cc > 0) {
      const ng = g - 1;
      if (!visited[ng]) {
        const nw = g2w[ng];
        if (nw >= 0 && wellRoi[nw] === targetMatch) { visited[ng] = 1; queue[tail++] = ng; }
      }
    }
    if (cc + 1 < nC) {
      const ng = g + 1;
      if (!visited[ng]) {
        const nw = g2w[ng];
        if (nw >= 0 && wellRoi[nw] === targetMatch) { visited[ng] = 1; queue[tail++] = ng; }
      }
    }
  }
  return result;
}

/** High-level flood fill or flood erase with Undo recording. Returns number of wells changed. */
function runFloodAction(chipState, seedWellIdx, mode) {
  if (mode === 'flood_fill') {
    const roi = ensureActiveRoi(chipState);
    const targetWells = computeFloodWells(chipState, seedWellIdx, 'flood_fill', roi.id);
    if (targetWells.length === 0) return 0;
    const delta = applyWellAssignments(chipState, targetWells, roi.id);
    if (delta) {
      pushHistory(chipState, {
        label: `Flood fill "${roi.name}" (${delta.wellIdx.length} wells)`,
        delta,
        roisBefore: null,
        roisAfter: null,
        activeBefore: chipState.activeRoiId,
        activeAfter: chipState.activeRoiId,
      });
      return delta.wellIdx.length;
    }
    return 0;
  }
  if (mode === 'flood_erase') {
    const targetWells = computeFloodWells(chipState, seedWellIdx, 'flood_erase', 0);
    if (targetWells.length === 0) return 0;
    const delta = applyWellAssignments(chipState, targetWells, 0);
    if (delta) {
      pushHistory(chipState, {
        label: `Flood erase (${delta.wellIdx.length} wells)`,
        delta,
        roisBefore: null,
        roisAfter: null,
        activeBefore: chipState.activeRoiId,
        activeAfter: chipState.activeRoiId,
      });
      return delta.wellIdx.length;
    }
    return 0;
  }
  return 0;
}

/** Clear all well assignments on the active chip (keeping ROI definitions), undoable. */
function clearChipSegmentation(chipState) {
  const wellRoi = chipState.wellRoi;
  const idx = [], prev = [];
  for (let w = 0; w < wellRoi.length; w++) {
    if (wellRoi[w] !== 0) { idx.push(w); prev.push(wellRoi[w]); wellRoi[w] = 0; }
  }
  if (idx.length === 0) return 0;
  recountRois(chipState);
  chipState.roiMapDirty = true;
  pushHistory(chipState, {
    label: `Clear all (${idx.length} wells)`,
    delta: { wellIdx: Int32Array.from(idx), prev: Uint16Array.from(prev), next: new Uint16Array(idx.length) },
    roisBefore: null,
    roisAfter: null,
    activeBefore: chipState.activeRoiId,
    activeAfter: chipState.activeRoiId,
  });
  return idx.length;
}

function applyDeltaAndRois(chipState, delta, reverse, roisSnap, activeSnap) {
  if (roisSnap) {
    chipState.rois = cloneRoiList(roisSnap);
    chipState.roiById.clear();
    let maxId = 0;
    for (let i = 0; i < chipState.rois.length; i++) {
      const r = chipState.rois[i];
      r.wellCount = 0;
      r.cellCount = 0;
      chipState.roiById.set(r.id, r);
      if (r.id > maxId) maxId = r.id;
    }
    if (chipState.nextRoiId <= maxId) chipState.nextRoiId = maxId + 1;
  }
  if (delta) {
    const { wellIdx, prev, next } = delta;
    const vals = reverse ? prev : next;
    const wellRoi = chipState.wellRoi;
    if (roisSnap) {
      for (let i = 0; i < wellIdx.length; i++) wellRoi[wellIdx[i]] = vals[i];
    } else {
      const roiById = chipState.roiById;
      const cellCounts = chipState.wells.wellCellCount;
      for (let i = 0; i < wellIdx.length; i++) {
        const w = wellIdx[i];
        const oldId = wellRoi[w];
        const newId = vals[i];
        if (oldId === newId) continue;
        wellRoi[w] = newId;
        const cc = cellCounts[w];
        if (oldId > 0) { const r = roiById.get(oldId); if (r) { r.wellCount--; r.cellCount -= cc; } }
        if (newId > 0) { const r = roiById.get(newId); if (r) { r.wellCount++; r.cellCount += cc; } }
      }
    }
  }
  if (roisSnap) recountRois(chipState);
  if (activeSnap !== undefined) chipState.activeRoiId = activeSnap;
  chipState.roiMapDirty = true;
}

function undoSeg(chipState) {
  if (!canUndo(chipState)) return null;
  const entry = chipState.history.entries[chipState.history.index--];
  applyDeltaAndRois(chipState, entry.delta, true, entry.roisBefore, entry.activeBefore);
  return entry;
}

function redoSeg(chipState) {
  if (!canRedo(chipState)) return null;
  const entry = chipState.history.entries[++chipState.history.index];
  applyDeltaAndRois(chipState, entry.delta, false, entry.roisAfter, entry.activeAfter);
  return entry;
}
