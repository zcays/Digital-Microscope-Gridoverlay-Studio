'use strict';
/* wells.js — Well lattice builder (explicit Survey array/well columns, metadata Array
 * geometry matching survey/spatial/core.py, or derived regular grid from cell x/y),
 * plus O(1) uniform-grid spatial indexes for wells and cells (exact Euclidean closestWell). */

/** Uniform-grid spatial index using flat Int32Array linked lists (zero per-item objects). */
class UniformGridIndex {
  constructor(xs, ys, count, minX, maxX, minY, maxY, cellSpan) {
    this.xs = xs;
    this.ys = ys;
    this.count = count;
    this.minX = minX;
    this.minY = minY;
    const spanX = Math.max(1e-6, maxX - minX);
    const spanY = Math.max(1e-6, maxY - minY);
    const targetSpan = cellSpan > 0 ? cellSpan : Math.max(spanX, spanY) / Math.max(1, Math.min(256, Math.sqrt(count)));
    this.invStep = 1 / Math.max(1e-6, targetSpan);
    this.gw = clamp(Math.ceil(spanX * this.invStep) + 1, 1, 512);
    this.gh = clamp(Math.ceil(spanY * this.invStep) + 1, 1, 512);
    // Recompute actual step so the grid spans the full bbox
    this.stepX = spanX / Math.max(1, this.gw - 1);
    this.stepY = spanY / Math.max(1, this.gh - 1);
    this.invStepX = this.stepX > 0 ? 1 / this.stepX : 1;
    this.invStepY = this.stepY > 0 ? 1 / this.stepY : 1;

    this.head = new Int32Array(this.gw * this.gh);
    this.head.fill(-1);
    this.next = new Int32Array(count);

    for (let i = 0; i < count; i++) {
      if (!Number.isFinite(xs[i]) || !Number.isFinite(ys[i])) continue;
      const gx = clamp(Math.floor((xs[i] - minX) * this.invStepX), 0, this.gw - 1);
      const gy = clamp(Math.floor((ys[i] - minY) * this.invStepY), 0, this.gh - 1);
      const b = gy * this.gw + gx;
      this.next[i] = this.head[b];
      this.head[b] = i;
    }
  }

  /**
   * Exact Euclidean nearest index to (x, y) — identical result to scipy cdist + argmin
   * in segment.py's InteractiveImage.closest(), in O(1) average time.
   */
  closest(x, y) {
    if (this.count === 0 || !Number.isFinite(x) || !Number.isFinite(y)) return -1;
    const gx0 = clamp(Math.floor((x - this.minX) * this.invStepX), 0, this.gw - 1);
    const gy0 = clamp(Math.floor((y - this.minY) * this.invStepY), 0, this.gh - 1);
    let bestIdx = -1;
    let bestD2 = Infinity;
    const maxRing = Math.max(this.gw, this.gh);
    const xs = this.xs, ys = this.ys, head = this.head, next = this.next, gw = this.gw, gh = this.gh;

    const scanBucket = (gx, gy) => {
      let idx = head[gy * gw + gx];
      while (idx !== -1) {
        const dx = xs[idx] - x;
        const dy = ys[idx] - y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD2 || (d2 === bestD2 && idx < bestIdx)) {
          bestD2 = d2;
          bestIdx = idx;
        }
        idx = next[idx];
      }
    };

    for (let ring = 0; ring <= maxRing; ring++) {
      if (ring === 0) {
        scanBucket(gx0, gy0);
      } else {
        const xLo = Math.max(0, gx0 - ring), xHi = Math.min(gw - 1, gx0 + ring);
        const yLo = Math.max(0, gy0 - ring), yHi = Math.min(gh - 1, gy0 + ring);
        if (gy0 - ring >= 0) {
          for (let gx = xLo; gx <= xHi; gx++) scanBucket(gx, gy0 - ring);
        }
        if (gy0 + ring < gh) {
          for (let gx = xLo; gx <= xHi; gx++) scanBucket(gx, gy0 + ring);
        }
        if (gx0 - ring >= 0) {
          for (let gy = Math.max(0, gy0 - ring + 1); gy <= Math.min(gh - 1, gy0 + ring - 1); gy++) scanBucket(gx0 - ring, gy);
        }
        if (gx0 + ring < gw) {
          for (let gy = Math.max(0, gy0 - ring + 1); gy <= Math.min(gh - 1, gy0 + ring - 1); gy++) scanBucket(gx0 + ring, gy);
        }
      }
      if (bestIdx !== -1) {
        // Minimum possible distance from (x, y) to any point outside ring `ring`
        const minPossible = Math.max(0, ring) * Math.min(this.stepX, this.stepY);
        if (ring >= 1 && minPossible * minPossible >= bestD2) break;
      }
    }
    return bestIdx;
  }

  /** Nearest point within maxRadius, or -1. */
  closestWithin(x, y, maxRadius) {
    const idx = this.closest(x, y);
    if (idx === -1) return -1;
    const dx = this.xs[idx] - x, dy = this.ys[idx] - y;
    return (dx * dx + dy * dy <= maxRadius * maxRadius) ? idx : -1;
  }
}

/**
 * Exact port of survey/spatial/core.py Array tessellation (n=4 square, n=6 flat-top hex).
 * Column-major well IDs 0..(nRows*nCols - 1), row 0 at top, col 0 at left.
 */
function generateArrayGeometry(params) {
  const n = params.n === 6 ? 6 : 4;
  const s = params.s;
  const w = params.w;
  const nRows = params.arr_shape[0];
  const nCols = params.arr_shape[1];
  const origin = params.origin || 'corner';
  const r2 = Math.SQRT2;
  const r3 = Math.sqrt(3);

  const polyVerts = (sides, radius, rotDeg) => {
    const rotRad = rotDeg * Math.PI / 180;
    const step = (2 * Math.PI) / sides;
    const out = new Float32Array(sides * 2);
    for (let i = 0; i < sides; i++) {
      out[i * 2] = radius * Math.sin(i * step + rotRad);
      out[i * 2 + 1] = radius * Math.cos(i * step + rotRad);
    }
    return out;
  };

  let baseVerts, xspaceX, yspaceX, xspaceY, yspaceY, xswitch, xlim, ylim;
  const calcMaxLim = shapeVal => (shapeVal - 0.5) * (s + w) + w / 2;
  if (n === 4) {
    baseVerts = polyVerts(4, (s / 2) * r2, 45);
    xspaceX = s + w; yspaceX = 0;
    xspaceY = 0; yspaceY = s + w;
    xswitch = 0;
    xlim = [-((s / 2) + w), calcMaxLim(nCols)];
    ylim = [-calcMaxLim(nRows), (s / 2) + w];
  } else {
    baseVerts = polyVerts(6, s / r3, 30);
    xspaceX = 1.5 * (s / r3) + w * (r3 / 2);
    yspaceX = (s + w) / 2;
    xspaceY = 0; yspaceY = s + w;
    xswitch = -1;
    xlim = [-(s / r3 + w), (nCols - 1) * xspaceX + (s / r3 + w)];
    ylim = [-(nRows * (s + w) + w / 2), (yspaceY + w) / 2];
  }

  let cx0 = 0, cy0 = 0;
  if (origin === 'corner') {
    let vminX = Infinity, vminY = Infinity;
    for (let k = 0; k < n; k++) {
      if (baseVerts[k * 2] < vminX) vminX = baseVerts[k * 2];
      if (baseVerts[k * 2 + 1] < vminY) vminY = baseVerts[k * 2 + 1];
    }
    cx0 = -vminX;
    cy0 = vminY;
    for (let k = 0; k < n; k++) {
      baseVerts[k * 2] -= vminX;
      baseVerts[k * 2 + 1] += vminY;
    }
    xlim = [xlim[0] - vminX, xlim[1] - vminX];
    ylim = [ylim[0] + vminY, ylim[1] + vminY];
  }

  const count = nRows * nCols;
  const wellIds = new Array(count);
  const rows = new Int32Array(count);
  const cols = new Int32Array(count);
  const cx = new Float32Array(count);
  const cy = new Float32Array(count);
  const gridToWell = new Int32Array(count);
  gridToWell.fill(-1);
  const wellIdToIdx = new Map();
  const verts = n === 6 ? new Float32Array(count * 12) : null;

  let curColX = cx0, curColY = cy0;
  let sw = xswitch;
  let idx = 0;
  for (let col = 0; col < nCols; col++) {
    let wx = curColX, wy = curColY;
    for (let row = 0; row < nRows; row++) {
      const idStr = String(idx);
      wellIds[idx] = idStr;
      rows[idx] = row;
      cols[idx] = col;
      cx[idx] = wx;
      cy[idx] = wy;
      gridToWell[row * nCols + col] = idx;
      wellIdToIdx.set(idStr, idx);
      if (verts) {
        const dx = wx - cx0, dy = wy - cy0;
        const off = idx * 12;
        for (let k = 0; k < 6; k++) {
          verts[off + k * 2] = baseVerts[k * 2] + dx;
          verts[off + k * 2 + 1] = baseVerts[k * 2 + 1] + dy;
        }
      }
      wx -= xspaceY;
      wy -= yspaceY;
      idx++;
    }
    curColX += xspaceX;
    curColY += yspaceX * sw;
    sw *= -1;
  }

  return {
    mode: 'array',
    nRows, nCols, count,
    wellIds, row: rows, col: cols, cx, cy,
    halfW: s * 0.5, halfH: s * 0.5,
    pitchX: xspaceX, pitchY: yspaceY,
    shape: n === 6 ? 'hex' : 'square',
    verts,
    minX: Math.min(xlim[0], xlim[1]), maxX: Math.max(xlim[0], xlim[1]),
    minY: Math.min(ylim[0], ylim[1]), maxY: Math.max(ylim[0], ylim[1]),
    yDown: false,
    gridToWell,
    wellIdToIdx,
  };
}

/** Estimate median positive step between sorted 1D values (returns 0 if none). */
function estimateLatticeStep(vals) {
  if (vals.length < 2) return 0;
  const sorted = Float64Array.from(vals).sort();
  const diffs = [];
  for (let i = 1; i < sorted.length; i++) {
    const d = sorted[i] - sorted[i - 1];
    if (d > 1e-6) diffs.push(d);
  }
  if (diffs.length === 0) return 0;
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length * 0.5)];
}

/**
 * Build the well grid, well-to-cell mapping, cell counts, and spatial indexes for one chip.
 */
function buildChipWells(dataset, cellIndices, chipName, meta, derivedOpts) {
  const cm = dataset.colMap;
  const xCol = dataset.columns[cm.x];
  const yCol = dataset.columns[cm.y];
  if (!xCol || !yCol || xCol.kind !== 'number' || yCol.kind !== 'number') {
    throw new Error('Selected X and Y columns must be numeric.');
  }

  const nCells = cellIndices.length;
  const xs = new Float32Array(nCells);
  const ys = new Float32Array(nCells);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < nCells; i++) {
    const r = cellIndices[i];
    const x = xs[i] = xCol.num[r], y = ys[i] = yCol.num[r];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const hasCellPositions = Number.isFinite(minX);
  if (!hasCellPositions) { minX = 0; maxX = 1; minY = 0; maxY = 1; }

  const wellIdCol = cm.wellId >= 0 ? dataset.columns[cm.wellId] : null;
  const rowCol = cm.row >= 0 ? dataset.columns[cm.row] : null;
  const colCol = cm.col >= 0 ? dataset.columns[cm.col] : null;
  const cxCol = cm.centerX >= 0 ? dataset.columns[cm.centerX] : null;
  const cyCol = cm.centerY >= 0 ? dataset.columns[cm.centerY] : null;

  const chipArrayMeta = (meta && meta.chips && meta.chips[chipName]) || (meta && meta.array) || null;
  let wells = null;

  // Case 1: Array geometry supplied in metadata (matches Survey Chip.array)
  if (chipArrayMeta) {
    wells = generateArrayGeometry(chipArrayMeta);
    const hasRowCol = rowCol && colCol && rowCol.kind === 'number' && colCol.kind === 'number';
    if (hasRowCol) {
      let rMax = -Infinity, cMax = -Infinity;
      for (let i = 0; i < nCells; i++) {
        const rIdx = cellIndices[i];
        const rr = rowCol.num[rIdx], cc = colCol.num[rIdx];
        if (rr > rMax) rMax = rr;
        if (cc > cMax) cMax = cc;
      }
      if (rMax >= wells.nRows || cMax >= wells.nCols) wells = null;
    } else if (hasCellPositions) {
      const overlapX = maxX >= wells.minX - wells.pitchX * 2 && minX <= wells.maxX + wells.pitchX * 2;
      const overlapY = maxY >= wells.minY - wells.pitchY * 2 && minY <= wells.maxY + wells.pitchY * 2;
      if (!overlapX || !overlapY) wells = null;
    }
  }

  // Case 2: Explicit arr-row and arr-col columns present in data
  if (!wells && rowCol && colCol && rowCol.kind === 'number' && colCol.kind === 'number') {
    let rMin = Infinity, rMax = -Infinity, cMin = Infinity, cMax = -Infinity;
    for (let i = 0; i < nCells; i++) {
      const rIdx = cellIndices[i];
      const rr = Math.round(rowCol.num[rIdx]), cc = Math.round(colCol.num[rIdx]);
      if (Number.isFinite(rr) && Number.isFinite(cc)) {
        if (rr < rMin) rMin = rr; if (rr > rMax) rMax = rr;
        if (cc < cMin) cMin = cc; if (cc > cMax) cMax = cc;
      }
    }
    const nRows = rMax - rMin + 1;
    const nCols = cMax - cMin + 1;
    if (nRows > 0 && nCols > 0 && nRows * nCols <= 500000) {
      const total = nRows * nCols;
      const sumX = new Float64Array(total);
      const sumY = new Float64Array(total);
      const cnt = new Uint32Array(total);
      const idByGrid = new Array(total);
      const observedWellIds = new Set();
      const hasExplicitCenter = cxCol && cyCol && cxCol.kind === 'number' && cyCol.kind === 'number';

      for (let i = 0; i < nCells; i++) {
        const rIdx = cellIndices[i];
        const wid = getColumnString(wellIdCol, rIdx);
        if (wid) observedWellIds.add(wid);
        const rr = Math.round(rowCol.num[rIdx]) - rMin;
        const cc = Math.round(colCol.num[rIdx]) - cMin;
        if (!(rr >= 0 && rr < nRows && cc >= 0 && cc < nCols)) continue;
        const g = rr * nCols + cc;
        const px = hasExplicitCenter && Number.isFinite(cxCol.num[rIdx]) ? cxCol.num[rIdx] : xs[i];
        const py = hasExplicitCenter && Number.isFinite(cyCol.num[rIdx]) ? cyCol.num[rIdx] : ys[i];
        if (Number.isFinite(px) && Number.isFinite(py)) {
          sumX[g] += px; sumY[g] += py; cnt[g]++;
        }
        if (wid && idByGrid[g] === undefined) idByGrid[g] = wid;
      }

      // Linear regression of center_x vs col and center_y vs row to accurately position empty wells too!
      let sc = 0, sr = 0, sx = 0, sy = 0, scc = 0, srr = 0, scx = 0, sry = 0, nPop = 0;
      for (let rr = 0; rr < nRows; rr++) {
        for (let cc = 0; cc < nCols; cc++) {
          const g = rr * nCols + cc;
          if (cnt[g] > 0) {
            const mx = sumX[g] / cnt[g], my = sumY[g] / cnt[g];
            sc += cc; sr += rr; sx += mx; sy += my;
            scc += cc * cc; srr += rr * rr; scx += cc * mx; sry += rr * my;
            nPop++;
          }
        }
      }
      const denomC = nPop * scc - sc * sc;
      const denomR = nPop * srr - sr * sr;
      const pitchX = Math.abs(denomC) > 1e-6 ? (nPop * scx - sc * sx) / denomC : (maxX - minX) / Math.max(1, nCols - 1);
      const pitchY = Math.abs(denomR) > 1e-6 ? (nPop * sry - sr * sy) / denomR : -(maxY - minY) / Math.max(1, nRows - 1);
      const originX = nPop > 0 ? (sx - pitchX * sc) / nPop : minX;
      const originY = nPop > 0 ? (sy - pitchY * sr) / nPop : maxY;
      const absPX = Math.max(1e-3, Math.abs(pitchX) || 1);
      const absPY = Math.max(1e-3, Math.abs(pitchY) || absPX);

      const wellIds = new Array(total);
      const rows = new Int32Array(total);
      const cols = new Int32Array(total);
      const cx = new Float32Array(total);
      const cy = new Float32Array(total);
      const gridToWell = new Int32Array(total);
      const wellIdToIdx = new Map();

      // Column-major index ordering matching Survey Array
      let idx = 0;
      let nextSyntheticId = total;
      for (let cc = 0; cc < nCols; cc++) {
        for (let rr = 0; rr < nRows; rr++) {
          const g = rr * nCols + cc;
          let wid = idByGrid[g];
          if (wid === undefined) {
            wid = String(idx);
            // Keep ordinary column-major IDs where they don't claim a source ID.
            while (observedWellIds.has(wid)) wid = String(nextSyntheticId++);
          }
          wellIds[idx] = wid;
          rows[idx] = rr;
          cols[idx] = cc;
          cx[idx] = cnt[g] > 0 ? (sumX[g] / cnt[g]) : (originX + cc * pitchX);
          cy[idx] = cnt[g] > 0 ? (sumY[g] / cnt[g]) : (originY + rr * pitchY);
          gridToWell[g] = idx;
          wellIdToIdx.set(wid, idx);
          idx++;
        }
      }
      let wMinX = Infinity, wMaxX = -Infinity, wMinY = Infinity, wMaxY = -Infinity;
      for (let i = 0; i < total; i++) {
        if (cx[i] < wMinX) wMinX = cx[i]; if (cx[i] > wMaxX) wMaxX = cx[i];
        if (cy[i] < wMinY) wMinY = cy[i]; if (cy[i] > wMaxY) wMaxY = cy[i];
      }
      wells = {
        mode: 'explicit',
        rowOffset: rMin, colOffset: cMin,
        nRows, nCols, count: total,
        wellIds, row: rows, col: cols, cx, cy,
        halfW: absPX * 0.44, halfH: absPY * 0.44,
        pitchX: absPX, pitchY: absPY,
        shape: 'square', verts: null,
        minX: wMinX - absPX * 0.55, maxX: wMaxX + absPX * 0.55,
        minY: wMinY - absPY * 0.55, maxY: wMaxY + absPY * 0.55,
        yDown: pitchY > 0,
        gridToWell, wellIdToIdx,
      };
    }
  }

  // Case 3: Explicit wellId column without row/col -> infer grid from well centroids
  if (!wells && wellIdCol) {
    const sumX = new Map(), sumY = new Map(), cnt = new Map();
    const hasExplicitCenter = cxCol && cyCol && cxCol.kind === 'number' && cyCol.kind === 'number';
    for (let i = 0; i < nCells; i++) {
      const rIdx = cellIndices[i];
      const wid = getColumnString(wellIdCol, rIdx);
      if (!wid) continue;
      const px = hasExplicitCenter && Number.isFinite(cxCol.num[rIdx]) ? cxCol.num[rIdx] : xs[i];
      const py = hasExplicitCenter && Number.isFinite(cyCol.num[rIdx]) ? cyCol.num[rIdx] : ys[i];
      if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
      sumX.set(wid, (sumX.get(wid) || 0) + px);
      sumY.set(wid, (sumY.get(wid) || 0) + py);
      cnt.set(wid, (cnt.get(wid) || 0) + 1);
    }
    const nUnique = cnt.size;
    if (nUnique > 0 && nUnique <= 250000) {
      const ids = Array.from(cnt.keys());
      const cxs = ids.map(id => sumX.get(id) / cnt.get(id));
      const cys = ids.map(id => sumY.get(id) / cnt.get(id));
      const spanX = Math.max(1e-6, maxX - minX), spanY = Math.max(1e-6, maxY - minY);
      const stepX = estimateLatticeStep(cxs), stepY = estimateLatticeStep(cys);
      const pitchX = stepX || stepY || Math.sqrt((spanX * spanY) / nUnique);
      const pitchY = stepY || pitchX;
      let wMinX = Infinity, wMaxX = -Infinity, wMinY = Infinity, wMaxY = -Infinity;
      for (let i = 0; i < nUnique; i++) {
        if (cxs[i] < wMinX) wMinX = cxs[i]; if (cxs[i] > wMaxX) wMaxX = cxs[i];
        if (cys[i] < wMinY) wMinY = cys[i]; if (cys[i] > wMaxY) wMaxY = cys[i];
      }
      const nCols = clamp(Math.round((wMaxX - wMinX) / pitchX) + 1, 1, 500);
      const nRows = clamp(Math.round((wMaxY - wMinY) / pitchY) + 1, 1, 500);
      const gridToWell = new Int32Array(nRows * nCols);
      gridToWell.fill(-1);
      const rows = new Int32Array(nUnique);
      const cols = new Int32Array(nUnique);
      const cx = new Float32Array(nUnique);
      const cy = new Float32Array(nUnique);
      const wellIdToIdx = new Map();
      for (let i = 0; i < nUnique; i++) {
        cx[i] = cxs[i]; cy[i] = cys[i];
        const cc = clamp(Math.round((cxs[i] - wMinX) / pitchX), 0, nCols - 1);
        const rr = clamp(Math.round((wMaxY - cys[i]) / pitchY), 0, nRows - 1);
        rows[i] = rr; cols[i] = cc;
        gridToWell[rr * nCols + cc] = i;
        wellIdToIdx.set(ids[i], i);
      }
      wells = {
        mode: 'explicit',
        rowOffset: 0, colOffset: 0,
        nRows, nCols, count: nUnique,
        wellIds: ids, row: rows, col: cols, cx, cy,
        halfW: pitchX * 0.44, halfH: pitchY * 0.44,
        pitchX, pitchY, shape: 'square', verts: null,
        minX: wMinX - pitchX * 0.55, maxX: wMaxX + pitchX * 0.55,
        minY: wMinY - pitchY * 0.55, maxY: wMaxY + pitchY * 0.55,
        yDown: false,
        gridToWell, wellIdToIdx,
      };
    }
  }

  // Case 4: Derive regular well grid from cell (x, y) coordinates
  if (!wells) {
    const spanX = Math.max(1e-3, maxX - minX);
    const spanY = Math.max(1e-3, maxY - minY);
    const maxSpan = Math.max(spanX, spanY);
    let pitch;
    if (derivedOpts && derivedOpts.mode === 'pitch' && derivedOpts.pitch > 0) {
      pitch = derivedOpts.pitch;
    } else {
      const bins = clamp(Math.round((derivedOpts && derivedOpts.targetBins) || 50), 4, 300);
      pitch = maxSpan / bins;
    }
    const nCols = clamp(Math.ceil(spanX / pitch) || 1, 1, 350);
    const nRows = clamp(Math.ceil(spanY / pitch) || 1, 1, 350);
    // Center grid cleanly over data bbox
    const gridW = nCols * pitch;
    const gridH = nRows * pitch;
    const originX = (minX + maxX) * 0.5 - gridW * 0.5;
    const topY = (minY + maxY) * 0.5 + gridH * 0.5;
    const count = nRows * nCols;
    const wellIds = new Array(count);
    const rows = new Int32Array(count);
    const cols = new Int32Array(count);
    const cx = new Float32Array(count);
    const cy = new Float32Array(count);
    const gridToWell = new Int32Array(count);
    const wellIdToIdx = new Map();

    let idx = 0;
    for (let cc = 0; cc < nCols; cc++) {
      for (let rr = 0; rr < nRows; rr++) {
        const wid = String(idx);
        wellIds[idx] = wid;
        rows[idx] = rr;
        cols[idx] = cc;
        cx[idx] = originX + (cc + 0.5) * pitch;
        cy[idx] = topY - (rr + 0.5) * pitch;
        gridToWell[rr * nCols + cc] = idx;
        wellIdToIdx.set(wid, idx);
        idx++;
      }
    }
    wells = {
      mode: 'derived',
      rowOffset: 0, colOffset: 0,
      nRows, nCols, count,
      wellIds, row: rows, col: cols, cx, cy,
      halfW: pitch * 0.48, halfH: pitch * 0.48,
      pitchX: pitch, pitchY: pitch,
      shape: 'square', verts: null,
      minX: originX, maxX: originX + gridW,
      minY: topY - gridH, maxY: topY,
      yDown: false,
      gridToWell, wellIdToIdx,
    };
  }

  // Build O(1) spatial index for wells
  wells.spatial = new UniformGridIndex(
    wells.cx, wells.cy, wells.count,
    wells.minX, wells.maxX, wells.minY, wells.maxY,
    Math.max(wells.pitchX, wells.pitchY) * 2
  );

  // Map every cell in this chip to its well index (and count cells per well)
  const cellWellIdx = new Int32Array(nCells);
  const wellCellCount = new Uint32Array(wells.count);
  const useRowColLookup = wells.mode !== 'derived' && rowCol && colCol && rowCol.kind === 'number' && colCol.kind === 'number';
  const rOff = wells.rowOffset || 0;
  const cOff = wells.colOffset || 0;
  const g2w = wells.gridToWell;
  const nR = wells.nRows, nC = wells.nCols;

  for (let i = 0; i < nCells; i++) {
    const rIdx = cellIndices[i];
    let wIdx = -1;
    if (wellIdCol && wells.mode !== 'derived') {
      const wid = getColumnString(wellIdCol, rIdx);
      if (wid) {
        const found = wells.wellIdToIdx.get(wid);
        if (found !== undefined) wIdx = found;
      }
    }
    if (wIdx === -1 && useRowColLookup) {
      const rr = Math.round(rowCol.num[rIdx]) - rOff;
      const cc = Math.round(colCol.num[rIdx]) - cOff;
      if (rr >= 0 && rr < nR && cc >= 0 && cc < nC) wIdx = g2w[rr * nC + cc];
    }
    if (wIdx === -1 && Number.isFinite(xs[i]) && Number.isFinite(ys[i])) {
      if (wells.mode === 'derived') {
        const cc = clamp(Math.floor((xs[i] - wells.minX) / wells.pitchX), 0, nC - 1);
        const rr = clamp(Math.floor((wells.maxY - ys[i]) / wells.pitchY), 0, nR - 1);
        wIdx = g2w[rr * nC + cc];
      } else {
        wIdx = wells.spatial.closest(xs[i], ys[i]);
      }
    }
    cellWellIdx[i] = wIdx;
    if (wIdx >= 0) wellCellCount[wIdx]++;
  }

  // Build spatial index for cells too (fast O(1) hover readout even at 1,000,000 cells!)
  const cellSpatial = new UniformGridIndex(
    xs, ys, nCells,
    Math.min(minX, wells.minX), Math.max(maxX, wells.maxX),
    Math.min(minY, wells.minY), Math.max(maxY, wells.maxY),
    Math.max(wells.pitchX, wells.pitchY)
  );

  wells.xs = xs;
  wells.ys = ys;
  wells.cellMinX = minX;
  wells.cellMaxX = maxX;
  wells.cellMinY = minY;
  wells.cellMaxY = maxY;
  wells.cellWellIdx = cellWellIdx;
  wells.wellCellCount = wellCellCount;
  wells.cellSpatial = cellSpatial;
  return wells;
}

/**
 * Exact JS port of segment.py InteractiveImage.closest(xs, ys).
 * Returns sorted array of unique well indices closest (by Euclidean distance) to the input (x, y) pairs.
 */
function closestWells(wells, xs, ys) {
  const n = Math.min(xs.length, ys.length);
  const seen = new Set();
  for (let i = 0; i < n; i++) {
    const idx = wells.spatial.closest(xs[i], ys[i]);
    if (idx >= 0) seen.add(idx);
  }
  return Array.from(seen).sort((a, b) => a - b);
}
