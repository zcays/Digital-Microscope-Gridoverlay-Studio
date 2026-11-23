'use strict';
/* io.js — RFC 4180 CSV export (primary per-cell segmentation CSV + per-ROI summary CSV),
 * Session JSON save/load, Segmentation CSV re-import onto loaded cells, and native Blob downloads
 * (matching Grid Studio's Electron will-download mechanism). */

const EXPORT_CHUNK_ROWS = 16384;

function csvEscape(value) {
  if (value == null) return '';
  const s = String(value);
  if (s.length === 0) return '';
  if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1 || s.indexOf('\r') !== -1) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function fileStem(name) {
  if (!name) return 'segmentation';
  return String(name).replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_') || 'segmentation';
}

function sanitizeGroupName(name) {
  const s = String(name || '').trim();
  return s || DEFAULT_SEGMENT_GROUP;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** The structural columns also identify this app's CSVs on re-import. */
function segmentationColumns(dataset) {
  const cm = dataset.colMap;
  const cols = dataset.columns;
  const hasExplicitWell = cm.wellId >= 0 || (cm.row >= 0 && cm.col >= 0);
  const includeCols = []; // { header, type: 'col'|'synthCellId'|'derivedWell'|'derivedRow'|'derivedCol'|'seg', colIdx? }
  const usedHeaders = new Set();
  const addUnique = (entry) => {
    const h = entry.header;
    if (usedHeaders.has(h)) return;
    usedHeaders.add(h);
    includeCols.push(entry);
  };

  if (cm.cellId >= 0) addUnique({ header: cols[cm.cellId].name, type: 'col', colIdx: cm.cellId });
  else addUnique({ header: 'cell_id', type: 'synthCellId' });

  addUnique({ header: cols[cm.x].name, type: 'col', colIdx: cm.x });
  addUnique({ header: cols[cm.y].name, type: 'col', colIdx: cm.y });

  if (cm.wellId >= 0) addUnique({ header: cols[cm.wellId].name, type: 'col', colIdx: cm.wellId });
  if (cm.row >= 0) addUnique({ header: cols[cm.row].name, type: 'col', colIdx: cm.row });
  if (cm.col >= 0) addUnique({ header: cols[cm.col].name, type: 'col', colIdx: cm.col });
  if (!hasExplicitWell) {
    addUnique({ header: 'well_id', type: 'derivedWell' });
    addUnique({ header: 'arr-row', type: 'derivedRow' });
    addUnique({ header: 'arr-col', type: 'derivedCol' });
  }
  if (cm.chip >= 0) addUnique({ header: cols[cm.chip].name, type: 'col', colIdx: cm.chip });

  return includeCols;
}

function segmentationLabelHeader(columns, group) {
  const used = new Set(columns.map(column => column.header.toLowerCase()));
  let header = group;
  while (used.has(header.toLowerCase())) header += '_roi';
  return header;
}

/**
 * Build primary per-cell segmentation CSV as chunked string parts (fast for 1,000,000+ rows).
 * Columns: cell_id, x, y, [present well/row/col/chip cols OR derived well_id,arr-row,arr-col], <group>
 * Matches survey/spatial/segment.py apply_segmentation_results + segutils.py pull_seg naming.
 */
function buildCellSegmentationCsvParts(dataset = S.data, chipStates = S.chipStates, groupName = S.group) {
  if (!dataset || dataset.rowCount === 0) throw new Error('Load a cell table before exporting.');
  const group = sanitizeGroupName(groupName);
  const cols = dataset.columns;
  const nRows = dataset.rowCount;

  const includeCols = segmentationColumns(dataset);
  includeCols.push({ header: segmentationLabelHeader(includeCols, group), type: 'seg' });

  // Build per-row lookup arrays: rowIdx -> wellIdx and rowIdx -> chipState index (O(N), zero GC pressure!)
  const chipList = S.chips.list;
  const rowChipIdx = new Int32Array(nRows);
  rowChipIdx.fill(-1);
  const rowWellIdx = new Int32Array(nRows);
  rowWellIdx.fill(-1);

  const chipStateArr = new Array(chipList.length);
  const chipRoiNames = new Array(chipList.length);
  for (let c = 0; c < chipList.length; c++) {
    const chipName = chipList[c];
    const cs = chipStates.get(chipName);
    const idxs = S.chips.cellIndicesByChip.get(chipName);
    chipStateArr[c] = cs;
    if (!cs || !idxs) continue;
    let maxRoiId = 0;
    for (let r = 0; r < cs.rois.length; r++) if (cs.rois[r].id > maxRoiId) maxRoiId = cs.rois[r].id;
    const names = new Array(maxRoiId + 1);
    names[0] = '';
    for (let r = 0; r < cs.rois.length; r++) names[cs.rois[r].id] = csvEscape(cs.rois[r].name);
    chipRoiNames[c] = names;
    const cw = cs.wells.cellWellIdx;
    for (let i = 0; i < idxs.length; i++) {
      const rIdx = idxs[i];
      rowChipIdx[rIdx] = c;
      rowWellIdx[rIdx] = cw[i];
    }
  }

  const headerLine = includeCols.map(c => csvEscape(c.header)).join(',') + '\n';
  const parts = [headerLine];
  const nOutCols = includeCols.length;
  const lineBuf = new Array(EXPORT_CHUNK_ROWS);
  const fieldBuf = new Array(nOutCols);

  // Pre-escape category strings per included categorical column for speed
  const escapedCats = includeCols.map(spec => {
    if (spec.type === 'col' && cols[spec.colIdx].kind === 'category') {
      return cols[spec.colIdx].categories.map(csvEscape);
    }
    return null;
  });

  for (let start = 0; start < nRows; start += EXPORT_CHUNK_ROWS) {
    const end = Math.min(nRows, start + EXPORT_CHUNK_ROWS);
    let bLen = 0;
    for (let r = start; r < end; r++) {
      const cIdx = rowChipIdx[r];
      const wIdx = rowWellIdx[r];
      const cs = cIdx >= 0 ? chipStateArr[cIdx] : null;
      for (let j = 0; j < nOutCols; j++) {
        const spec = includeCols[j];
        if (spec.type === 'col') {
          const col = cols[spec.colIdx];
          if (col.kind === 'number') {
            const v = col.num[r];
            fieldBuf[j] = Number.isNaN(v) ? '' : String(v);
          } else if (col.kind === 'category') {
            const code = col.codes[r];
            fieldBuf[j] = code > 0 ? escapedCats[j][code - 1] : '';
          } else {
            fieldBuf[j] = csvEscape(col.strings[r]);
          }
        } else if (spec.type === 'synthCellId') {
          fieldBuf[j] = 'cell_' + (r + 1);
        } else if (spec.type === 'derivedWell') {
          fieldBuf[j] = (cs && wIdx >= 0) ? csvEscape(cs.wells.wellIds[wIdx]) : '';
        } else if (spec.type === 'derivedRow') {
          fieldBuf[j] = (cs && wIdx >= 0) ? String(cs.wells.row[wIdx]) : '';
        } else if (spec.type === 'derivedCol') {
          fieldBuf[j] = (cs && wIdx >= 0) ? String(cs.wells.col[wIdx]) : '';
        } else if (spec.type === 'seg') {
          if (cs && wIdx >= 0) {
            const rid = cs.wellRoi[wIdx];
            fieldBuf[j] = rid > 0 ? (chipRoiNames[cIdx][rid] || '') : '';
          } else {
            fieldBuf[j] = '';
          }
        }
      }
      lineBuf[bLen++] = fieldBuf.join(',');
    }
    if (bLen === EXPORT_CHUNK_ROWS) {
      parts.push(lineBuf.join('\n') + '\n');
    } else {
      parts.push(lineBuf.slice(0, bLen).join('\n') + '\n');
    }
  }

  const filename = `${fileStem(dataset.fileName)}_segmentation_${fileStem(group)}.csv`;
  return {
    headers: includeCols.map(c => c.header),
    parts,
    filename,
    rowCount: nRows,
  };
}

function buildCellSegmentationCsvBlob(dataset = S.data, chipStates = S.chipStates, groupName = S.group) {
  const built = buildCellSegmentationCsvParts(dataset, chipStates, groupName);
  return {
    blob: new Blob(built.parts, { type: 'text/csv;charset=utf-8' }),
    filename: built.filename,
    headers: built.headers,
    rowCount: built.rowCount,
  };
}

/**
 * Build per-ROI summary CSV:
 * Single chip: roi,color,cell_count,well_count
 * Multi-chip:  chip,roi,color,cell_count,well_count
 */
function buildRoiSummaryCsvText(chipStates = S.chipStates, chipsList = S.chips.list, groupName = S.group) {
  const multi = chipsList.length > 1;
  const lines = [multi ? 'chip,roi,color,cell_count,well_count' : 'roi,color,cell_count,well_count'];
  for (let c = 0; c < chipsList.length; c++) {
    const chipName = chipsList[c];
    const cs = chipStates.get(chipName);
    if (!cs) continue;
    for (let i = 0; i < cs.rois.length; i++) {
      const r = cs.rois[i];
      if (multi) {
        lines.push([csvEscape(chipName), csvEscape(r.name), csvEscape(r.color), r.cellCount, r.wellCount].join(','));
      } else {
        lines.push([csvEscape(r.name), csvEscape(r.color), r.cellCount, r.wellCount].join(','));
      }
    }
  }
  const filename = `${fileStem(S.data.fileName)}_roi_summary_${fileStem(sanitizeGroupName(groupName))}.csv`;
  return { text: lines.join('\n') + '\n', filename };
}

/** Build a portable Session JSON snapshot that resumes ROIs, well assignments, and display settings. */
function buildSessionSnapshot() {
  const cm = S.data.colMap;
  const colName = idx => (idx >= 0 && S.data.columns[idx]) ? S.data.columns[idx].name : null;
  const chipsObj = Object.create(null);
  for (const chipName of S.chips.list) {
    const cs = S.chipStates.get(chipName);
    if (!cs) continue;
    const wellsByRoi = Object.create(null);
    for (const r of cs.rois) wellsByRoi[r.name] = [];
    const wellRoi = cs.wellRoi, wellIds = cs.wells.wellIds;
    for (let w = 0; w < wellRoi.length; w++) {
      const rid = wellRoi[w];
      if (rid > 0) {
        const r = cs.roiById.get(rid);
        if (r) wellsByRoi[r.name].push(wellIds[w]);
      }
    }
    chipsObj[chipName] = {
      wellMode: cs.wells.mode,
      nRows: cs.wells.nRows,
      nCols: cs.wells.nCols,
      activeRoi: (cs.roiById.get(cs.activeRoiId) || {}).name || '',
      rois: cs.rois.map(r => ({ name: r.name, color: r.color, wells: wellsByRoi[r.name] })),
    };
  }
  return {
    app: 'SUGAR Segment',
    kind: 'sugar-segment-session',
    version: 1,
    savedAt: new Date().toISOString(),
    sourceFile: S.data.fileName || '',
    rowCount: S.data.rowCount,
    group: sanitizeGroupName(S.group),
    activeChip: S.chips.active,
    derivedGrid: { ...S.derivedGrid },
    columns: {
      cellId: colName(cm.cellId),
      x: colName(cm.x),
      y: colName(cm.y),
      wellId: colName(cm.wellId),
      row: colName(cm.row),
      col: colName(cm.col),
      centerX: colName(cm.centerX),
      centerY: colName(cm.centerY),
      chip: colName(cm.chip),
      color: colName(cm.color),
    },
    display: {
      cellSize: S.display.cellSize,
      cellAlpha: S.display.cellAlpha,
      roiAlpha: S.display.roiAlpha,
      showBorders: S.display.showBorders,
      showCells: S.display.showCells,
      showRois: S.display.showRois,
      colormap: S.display.colormap,
      clipPercentile: S.display.clipPercentile,
      logScale: S.display.logScale,
      yInvert: S.display.yInvert,
      brushSize: S.brushSize,
      autoResetFlood: S.autoResetFlood,
    },
    metaColors: {
      colorsByCol: S.meta.colorsByCol,
      flatColors: S.meta.flatColors,
    },
    chips: chipsObj,
  };
}

/** Stage an import on a detached chip state so a failure leaves the original history and labels intact. */
function draftImportedChip(previous, keepRois) {
  const draft = createChipSegState(previous.wells);
  if (keepRois) {
    draft.rois = cloneRoiList(previous.rois);
    draft.nextRoiId = previous.nextRoiId;
    draft.activeRoiId = previous.activeRoiId;
    draft.wellRoi.set(previous.wellRoi);
    for (const roi of draft.rois) draft.roiById.set(roi.id, roi);
  }
  return draft;
}

function stageSegmentationImport(previous, draft, label) {
  recountRois(draft);
  const idx = [], prev = [], next = [];
  for (let w = 0; w < draft.wellRoi.length; w++) {
    const before = previous.wellRoi[w];
    const after = draft.wellRoi[w];
    if (before !== after) { idx.push(w); prev.push(before); next.push(after); }
  }
  const entry = {
    label,
    delta: idx.length ? { wellIdx: Int32Array.from(idx), prev: Uint16Array.from(prev), next: Uint16Array.from(next) } : null,
    roisBefore: cloneRoiList(previous.rois),
    roisAfter: cloneRoiList(draft.rois),
    activeBefore: previous.activeRoiId,
    activeAfter: draft.activeRoiId,
  };
  return { draft, entry };
}

function commitSegmentationImports(states, changes) {
  for (const [key, { draft, entry }] of changes) {
    const previous = states.get(key);
    draft.history = { entries: previous.history.entries.slice(), index: previous.history.index };
    pushHistory(draft, entry);
    Object.assign(previous, draft);
  }
}

function createImportedRoi(chip, name, color) {
  if (chip.nextRoiId > 0xffff) throw new Error('Too many ROIs for one chip.');
  return createRoi(chip, name, color, false);
}

/** Restore a previously saved Session JSON onto the currently loaded dataset. */
function applySessionSnapshot(obj) {
  if (!obj || typeof obj !== 'object' || obj.kind !== 'sugar-segment-session') {
    throw new Error('This file is not a SUGAR Segment session JSON.');
  }
  if (obj.version !== 1) throw new Error(`Unsupported session version: ${obj.version}`);
  if (S.data.rowCount === 0) throw new Error('Load the cell file first, then load the session JSON.');

  const warnings = [];
  if (obj.rowCount && obj.rowCount !== S.data.rowCount) {
    warnings.push(`Row count differs (session: ${obj.rowCount.toLocaleString()}, current: ${S.data.rowCount.toLocaleString()}).`);
  }

  const derivedGrid = { ...S.derivedGrid };
  if (obj.derivedGrid && typeof obj.derivedGrid === 'object') {
    const { mode, targetBins, pitch } = obj.derivedGrid;
    if (['auto', 'bins', 'pitch'].includes(mode)) derivedGrid.mode = mode;
    if (Number.isFinite(targetBins) && targetBins > 0) derivedGrid.targetBins = clamp(Math.round(targetBins), 4, 300);
    if (Number.isFinite(pitch) && pitch >= 0) derivedGrid.pitch = pitch;
  }

  const colMap = { ...S.data.colMap };
  if (obj.columns && typeof obj.columns === 'object') {
    const numeric = new Set(['x', 'y', 'row', 'col', 'centerX', 'centerY']);
    for (const key of Object.keys(colMap)) {
      if (!Object.hasOwn(obj.columns, key)) continue; // Older sessions omit center columns.
      const name = obj.columns[key];
      const index = typeof name === 'string' ? S.data.headers.indexOf(name) : -1;
      if (name === null && key !== 'x' && key !== 'y') colMap[key] = -1;
      else if (index >= 0 && (!numeric.has(key) || S.data.columns[index].kind === 'number')) colMap[key] = index;
      else throw new Error(`Session column "${name}" for ${key} is unavailable in the loaded table.`);
    }
  }

  const rebuild = Object.keys(colMap).some(key => key !== 'color' && key !== 'cellId' && colMap[key] !== S.data.colMap[key]) ||
    Object.keys(derivedGrid).some(key => derivedGrid[key] !== S.derivedGrid[key]);
  const workspace = rebuild
    ? prepareChipWorkspace({ ...S.data, colMap }, S.meta, derivedGrid, true)
    : null;
  const states = workspace ? workspace.states : S.chipStates;
  const changes = new Map();
  let restoredWells = 0;
  let restoredRois = 0;
  const chipsIn = obj.chips;
  if (!chipsIn || typeof chipsIn !== 'object' || Array.isArray(chipsIn)) throw new Error('Session has no chip data.');
  for (const [chipKey, chipSnap] of Object.entries(chipsIn)) {
    const previous = states.get(chipKey);
    if (!previous) {
      warnings.push(`Chip "${chipKey}" not in current dataset.`);
      continue;
    }
    if (!chipSnap || !Array.isArray(chipSnap.rois)) throw new Error(`Invalid ROI data for chip "${chipKey}".`);
    const { wells } = previous;
    if ((chipSnap.wellMode && chipSnap.wellMode !== wells.mode) ||
        (chipSnap.nRows != null && chipSnap.nRows !== wells.nRows) ||
        (chipSnap.nCols != null && chipSnap.nCols !== wells.nCols)) {
      throw new Error(`Session grid differs for chip "${chipKey}". Load the original cell table and metadata first.`);
    }

    const draft = draftImportedChip(previous, false);
    for (const def of chipSnap.rois) {
      if (!def || typeof def.name !== 'string' || !Array.isArray(def.wells)) {
        throw new Error(`Invalid ROI data for chip "${chipKey}".`);
      }
      const roi = createImportedRoi(draft, def.name, def.color);
      restoredRois++;
      for (const id of def.wells) {
        const index = wells.wellIdToIdx.get(String(id));
        if (index === undefined) throw new Error(`Session well "${id}" is missing from chip "${chipKey}".`);
        if (draft.wellRoi[index]) throw new Error(`Session well "${id}" has multiple labels on chip "${chipKey}".`);
        draft.wellRoi[index] = roi.id;
        restoredWells++;
      }
    }
    const selected = draft.rois.find(roi => roi.name === chipSnap.activeRoi);
    draft.activeRoiId = selected?.id ?? draft.rois[0]?.id ?? 0;
    changes.set(chipKey, stageSegmentationImport(previous, draft, 'Load session'));
  }
  if (changes.size === 0) throw new Error('No chips in this session matched the loaded dataset.');

  const active = states.has(obj.activeChip) ? obj.activeChip : S.chips.active;
  const fit = rebuild || active !== S.chips.active;
  if (workspace?.dropped) {
    // Restored chips have their session assignments. Report unmatched wells only for other chips.
    let skipped = workspace.dropped;
    for (const key of changes.keys()) skipped -= workspace.droppedByChip.get(key) || 0;
    if (skipped > 0) warnings.push(droppedLabelsMessage(skipped).trim());
  }
  finishStagePointer();
  commitSegmentationImports(states, changes);
  S.data.colMap = colMap;
  Object.assign(S.derivedGrid, derivedGrid);
  if (workspace) {
    publishChipWorkspace(workspace, active);
    S.display.yInvert = S.meta.yInvert ?? Boolean(activeChipState()?.wells.yDown);
  } else {
    S.chips.active = active;
  }
  if (typeof obj.group === 'string') S.group = sanitizeGroupName(obj.group);
  if (obj.display && typeof obj.display === 'object') {
    const d = obj.display;
    if (Number.isFinite(d.cellSize)) S.display.cellSize = clamp(d.cellSize, 1, 20);
    if (Number.isFinite(d.cellAlpha)) S.display.cellAlpha = clamp(d.cellAlpha, 0.05, 1);
    if (Number.isFinite(d.roiAlpha)) S.display.roiAlpha = clamp(d.roiAlpha, 0, 1);
    for (const key of ['showBorders', 'showCells', 'showRois', 'clipPercentile', 'logScale', 'yInvert']) {
      if (typeof d[key] === 'boolean') S.display[key] = d[key];
    }
    if (typeof d.colormap === 'string' && Object.hasOwn(COLORMAP_LUTS, d.colormap)) S.display.colormap = d.colormap;
    if (Number.isFinite(d.brushSize)) S.brushSize = clamp(Math.round(d.brushSize) | 1, 1, 15);
    if (typeof d.autoResetFlood === 'boolean') S.autoResetFlood = d.autoResetFlood;
  }
  if (obj.metaColors && typeof obj.metaColors === 'object') {
    S.meta.colorsByCol = { ...S.meta.colorsByCol, ...obj.metaColors.colorsByCol };
    S.meta.flatColors = { ...S.meta.flatColors, ...obj.metaColors.flatColors };
    S.metaRev++;
  }
  refreshChipWorkspace(fit);
  return { restoredRois, restoredWells, warnings };
}

/** Infer import roles without interpreting IDs or labels as numbers or missing-value tokens. */
function segmentationImportColumns(headers, hasHeader) {
  const group = sanitizeGroupName(S.group);
  if (!hasHeader) return { cell: 0, chip: -1, well: -1, label: headers.length - 1, groupName: group };
  const structural = segmentationColumns(S.data);
  const lower = headers.map(h => h.trim().toLowerCase());
  const ownFormat = headers.length === structural.length + 1 &&
    structural.every((column, index) => column.header === headers[index]);

  // In older exports a collision could create two identically named headers.
  const dataHeaders = ownFormat ? lower.slice(0, -1) : lower;
  const findRole = (role, aliases, excluded = -1) => {
    const name = S.data.columns[S.data.colMap[role]]?.name;
    const exact = headers.findIndex((header, i) => i < dataHeaders.length && i !== excluded && header === name);
    if (exact >= 0) return exact;
    return dataHeaders.findIndex((header, i) => i !== excluded && (header === name?.toLowerCase() || aliases.test(header)));
  };

  const cell = findRole('cellId', /^(cell_id|cellid|cbc|cell_barcode|barcode|obs_names|obs_name|cell|unnamed: 0|index)$/);
  const chip = findRole('chip', /(?:^|[:.])(?:chip[-_]?num|chip_id|chip|array_id)$/);
  const well = findRole('wellId', /^(well_id|wellid|well|spot_id|spot|well_name|id)$/, cell);
  const reserved = new Set(structural.map(column => column.header.toLowerCase()));
  const available = lower.map((header, i) => i !== cell && i !== chip && i !== well && !reserved.has(header));
  const exportHeader = segmentationLabelHeader(structural, group).toLowerCase();
  const findLabel = name => lower.findIndex((header, i) => available[i] && header === name);
  let label = ownFormat ? headers.length - 1 : findLabel(group.toLowerCase());
  if (label < 0) label = findLabel(exportHeader);
  for (const name of ['tissue', 'roi', 'segment', 'region', 'label', 'seg']) {
    if (label < 0) label = findLabel(name);
  }
  if (label < 0 && available[headers.length - 1]) label = headers.length - 1;
  if (label < 0) throw new Error('Could not find a segmentation label column in this CSV.');
  const header = headers[label].trim();
  const legacyCollision = ownFormat && lower[label] === group.toLowerCase() + '_roi' && reserved.has(group.toLowerCase());
  const groupName = header && lower[label] !== exportHeader && !legacyCollision
    ? sanitizeGroupName(header)
    : group;
  return { cell, chip, well, label, groupName };
}

/**
 * Re-import labels by cell ID, scoped by chip when supplied, or by well ID on one chip.
 * Only matched wells receive edits. An empty label clears a matched well with no nonempty labels.
 */
async function importSegmentationCsv(source, fileName = 'segmentation.csv') {
  if (S.data.rowCount === 0) throw new Error('Load a cell table first before importing segmentation labels.');
  const datasetColumns = S.data.columns;
  const mapping = S.data.colMap;
  const groups = S.chips.cellIndicesByChip;
  const active = S.chips.active;
  const raw = typeof source === 'string' ? source : await source.text();
  if (datasetColumns !== S.data.columns || mapping !== S.data.colMap || groups !== S.chips.cellIndicesByChip) {
    throw new Error('The dataset or column mapping changed while reading labels. Import the file again.');
  }
  if (!raw.trim()) throw new Error('The selected file is empty.');
  const text = raw.replace(/^\uFEFF/, '') + '\n';
  const delimiter = detectDelimiter(text.slice(0, 262144));
  const read = pos => readCsvRecord(text, pos, delimiter.delimiter.charCodeAt(0), delimiter.isWhitespace, false);
  const first = read(0);
  if (!first?.fields || first.fields.length < 2) throw new Error('Expected a label CSV with at least two columns.');
  const second = read(first.nextPos);
  const hasHeader = detectHasHeader(first.fields, second?.fields ? [second.fields] : []);
  const { cell, chip, well, label, groupName } = segmentationImportColumns(first.fields, hasHeader);

  const rowToChip = new Array(S.data.rowCount);
  const rowToWell = new Int32Array(S.data.rowCount).fill(-1);
  const idsByChip = new Map();
  const dataIds = S.data.columns[S.data.colMap.cellId];
  const scoped = chip >= 0;
  for (const [chipName, rows] of groups) {
    const cs = S.chipStates.get(chipName);
    const scope = scoped ? chipName : '';
    if (cell >= 0 && !idsByChip.has(scope)) idsByChip.set(scope, new Map());
    const ids = idsByChip.get(scope);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      rowToChip[row] = chipName;
      rowToWell[row] = cs.wells.cellWellIdx[i];
      if (ids) {
        const id = dataIds ? getColumnString(dataIds, row) : 'cell_' + (row + 1);
        if (!id) continue;
        const previous = ids.get(id);
        if (previous === undefined) ids.set(id, row);
        else if (previous >= 0 && (rowToChip[previous] !== chipName || rowToWell[previous] !== rowToWell[row])) ids.set(id, -1);
      }
    }
  }

  const votesByChip = new Map();
  let matchedCells = 0, labeledCells = 0, row = 0;
  let pos = hasHeader ? first.nextPos : 0;
  while (pos < text.length) {
    const record = read(pos);
    if (!record) break;
    if (record.incomplete) throw new Error('The label CSV contains an unclosed quoted field.');
    pos = record.nextPos;
    const fields = record.fields;
    if (!fields) continue;
    if (fields.length !== first.fields.length) throw new Error('The label CSV has an inconsistent number of columns.');

    const scope = scoped ? fields[chip] || 'unassigned' : active;
    let chipName, wIdx;
    if (cell >= 0) {
      const id = fields[cell];
      const match = idsByChip.get(scoped ? scope : '')?.get(id);
      if (match === -1) throw new Error(`Cell ID "${id}" is ambiguous. Include a chip column or use unique well IDs.`);
      if (match !== undefined) {
        chipName = rowToChip[match];
        wIdx = rowToWell[match];
      }
    } else if (well >= 0) {
      chipName = scope;
      wIdx = S.chipStates.get(scope)?.wells.wellIdToIdx.get(fields[well]);
    } else {
      chipName = rowToChip[row];
      if (scoped && chipName !== scope) throw new Error('CSV chip values do not match the dataset row order. Include cell IDs or well IDs.');
      wIdx = rowToWell[row];
    }
    row++;

    if (wIdx === undefined || wIdx < 0) continue;
    matchedCells++;
    const name = fields[label].trim();
    if (name) labeledCells++;
    if (!votesByChip.has(chipName)) votesByChip.set(chipName, new Map());
    const chipVotes = votesByChip.get(chipName);
    if (!chipVotes.has(wIdx)) chipVotes.set(wIdx, new Map());
    const votes = chipVotes.get(wIdx);
    if (name) {
      const key = name.toLowerCase();
      const vote = votes.get(key);
      if (vote) vote.count++;
      else votes.set(key, { name, count: 1 });
    }
  }
  if (cell < 0 && well < 0 && row !== S.data.rowCount) {
    throw new Error('Include cell IDs or well IDs when importing a subset of rows.');
  }
  if (matchedCells === 0) throw new Error('No cells or wells in this CSV matched the loaded dataset.');

  const changes = new Map();
  let labeledWells = 0, roisCreated = 0;
  for (const [chipName, chipVotes] of votesByChip) {
    const previous = S.chipStates.get(chipName);
    const draft = draftImportedChip(previous, true);
    const roiByName = new Map(draft.rois.map(roi => [roi.name.toLowerCase(), roi]));
    for (const [wIdx, votes] of chipVotes) {
      let winner;
      for (const vote of votes.values()) {
        if (!winner || vote.count > winner.count) winner = vote;
      }
      if (!winner) {
        draft.wellRoi[wIdx] = 0;
        continue;
      }
      const key = winner.name.toLowerCase();
      let roi = roiByName.get(key);
      if (!roi) {
        roi = createImportedRoi(draft, winner.name, null);
        roiByName.set(key, roi);
        roisCreated++;
      }
      draft.wellRoi[wIdx] = roi.id;
      labeledWells++;
    }
    if (draft.roiById.has(previous.activeRoiId)) draft.activeRoiId = previous.activeRoiId;
    changes.set(chipName, stageSegmentationImport(previous, draft, `Import CSV "${fileName}"`));
  }

  finishStagePointer();
  commitSegmentationImports(S.chipStates, changes);
  S.group = groupName;
  refresh('overlay', 'ui', 'rois', 'status');
  return { matchedCells, labeledCells, labeledWells, roisCreated, groupName };
}
