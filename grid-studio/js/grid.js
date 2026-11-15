'use strict';
/* grid.js — the grid overlay: layout maths (gridLayout) and drawing (drawGrid). Draws into <canvas id="grid"> and, with k=1, into the PNG export.
 * The grid is STATIC: it depends only on S.grid / S.chip / canvas size, never on the image.
 * Two modes, chosen by activePreset() (presets.js):
 *   chip ticked → shape/size/pitch come from the chip table × pxPerUm() (true to scale). Either just the real N×M array centred
 *                 (S.chip.fit) or tiled across the whole canvas.
 *   no chip     → manual sliders: size, gaps, dead-space margins, cols/rows.
 * arrayRect() = the chip array's outer edge (wells + half a wall); arrayCropRect() = the same in whole canvas px while "Crop to array"
 *   (S.chip.arrayOnly) is on. Showing / exporting only that rectangle is done in crop.js (updateArrayMask) and export.js.
 * gridLayout() returns {shape, size, pitchX, pitchY, i0..i1, j0..j1, x0, y0} in canvas px; cell (i,j) is at x0+i·pitchX, y0+j·pitchY.
 * Line width: S.grid.stroke × max(1, canvasWidth/1200) — see gridLineWidth().
 * drawGrid() never clears (it paints over what is there); renderGrid() clears the overlay canvas first.
 * Outlines are drawn INSET so the outer edge of a cell is always exactly `size` (stroke width never changes the geometry). */

const MAX_CELLS = 400000;

/** Index range of cells (origin + i*pitch) that touch [0, total]; cells cut by the edge are included. */
const tileRange = (origin, size, pitch, total) => [Math.floor((-size - origin) / pitch) + 1, Math.ceil((total - origin) / pitch)];

/** The chip array's OUTER EDGE on the canvas: every well plus half a wall all the way round (= wide × long whole pitches), in canvas px.
 *  null unless a chip is ticked with "Fit canvas to array" (only then does the array have a definite place). */
function arrayRect() {
  const P = activePreset(); if (!P || !S.chip.fit) return null;
  const L = gridLayout(S.doc.w, S.doc.h); if (!L) return null;
  return {x: L.x0 - (L.pitchX - L.size) / 2, y: L.y0 - (L.pitchY - L.size) / 2, w: P.wide * L.pitchX, h: P.long * L.pitchY};
}
/** The same rectangle in WHOLE canvas pixels and limited to the canvas (what "Crop to array" shows and exports), or null when it is off / not available. */
function arrayCropRect() {
  const r = S.chip.arrayOnly ? arrayRect() : null; if (!r) return null;
  const x0 = clamp(Math.round(r.x), 0, S.doc.w), y0 = clamp(Math.round(r.y), 0, S.doc.h), x1 = clamp(Math.round(r.x + r.w), 0, S.doc.w), y1 = clamp(Math.round(r.y + r.h), 0, S.doc.h);
  return x1 > x0 && y1 > y0 ? {x: x0, y: y0, w: x1 - x0, h: y1 - y0} : null;
}
/** Describe the grid to draw: cell shape/size/pitch, first cell position and the index ranges. */
function gridLayout(w, h) {
  const G = S.grid, P = activePreset();

  if (P) {                                   // chip version: true-to-scale, fills the whole plane
    const k = pxPerUm(), size = P.well * k, pitch = P.pitch * k;
    if (size < .5 || pitch < 1) return null;
    const L = {shape: P.shape, size, pitchX: pitch, pitchY: pitch};
    if (S.chip.fit) {                        // canvas fits the real N × M array: draw just the array, centred
      Object.assign(L, {i0: 0, i1: P.wide, j0: 0, j1: P.long});
      L.x0 = (w - (P.wide * pitch - (pitch - size))) / 2 + G.offX;
      L.y0 = (h - (P.long * pitch - (pitch - size))) / 2 + G.offY;
    } else {
      L.x0 = G.offX; L.y0 = G.offY;
      [L.i0, L.i1] = tileRange(L.x0, size, pitch, w); [L.j0, L.j1] = tileRange(L.y0, size, pitch, h);
    }
    return L;
  }

  const size = Math.max(1, G.size), pitchX = size + G.gapX, pitchY = size + G.gapY;   // manual grid
  if (pitchX < 1 || pitchY < 1) return null;
  const count = (avail, pitch, gap, fixed) => fixed > 0 ? fixed : Math.max(0, Math.floor((avail + gap) / pitch));
  const availW = w - G.mL - G.mR, availH = h - G.mT - G.mB;
  const cols = count(availW, pitchX, G.gapX, G.cols), rows = count(availH, pitchY, G.gapY, G.rows);
  if (cols < 1 || rows < 1) return null;
  const spareX = availW - (cols * pitchX - G.gapX), spareY = availH - (rows * pitchY - G.gapY);
  return {
    shape: G.shape, size, pitchX, pitchY, i0: 0, i1: cols, j0: 0, j1: rows,
    x0: G.mL + (G.center ? spareX / 2 : 0) + G.offX,
    y0: G.mT + (G.center ? spareY / 2 : 0) + G.offY,
  };
}

/** Outline thickness in canvas px. The slider value is for a 1200 px wide canvas and grows with bigger canvases
 *  (chip-fit canvases are ~2000 px), so the walls look equally thick whatever the canvas size. */
const GRID_REF_WIDTH = 1200;
const gridLineWidth = w => S.grid.stroke * Math.max(1, w / GRID_REF_WIDTH);

/** Draw the grid for a w×h canvas onto ctx; k = canvas pixels per document pixel.
 *  Does NOT clear the canvas: it draws on top of whatever is there (export relies on this). renderGrid() clears first. */
function drawGrid(ctx, w, h, k) {
  const G = S.grid; if (!G.visible) return;
  const L = gridLayout(w, h); if (!L) return;
  if ((L.i1 - L.i0) * (L.j1 - L.j0) > MAX_CELLS) return toast('Too many cells — zoom the grid in or raise the size');

  const filled = G.mode === 'filled', circle = L.shape === 'circle';
  const lineW = filled ? 0 : Math.min(gridLineWidth(w), L.size / 2), inset = lineW / 2, side = L.size - lineW;
  const radius = Math.min(G.radius, side / 2), rounded = !circle && radius > 0 && typeof ctx.roundRect === 'function';

  ctx.save(); ctx.scale(k, k); ctx.globalAlpha = G.opacity; ctx.beginPath();
  for (let j = L.j0; j < L.j1; j++) for (let i = L.i0; i < L.i1; i++) {
    const x = L.x0 + i * L.pitchX + inset, y = L.y0 + j * L.pitchY + inset;
    if (circle) { const r = side / 2; ctx.moveTo(x + side, y + r); ctx.arc(x + r, y + r, r, 0, Math.PI * 2); }
    else if (rounded) ctx.roundRect(x, y, side, side, radius);
    else ctx.rect(x, y, side, side);
  }
  if (filled) { ctx.fillStyle = G.color; ctx.fill(); }
  else { ctx.strokeStyle = G.color; ctx.lineWidth = lineW; ctx.stroke(); }
  ctx.restore();
}

function renderGrid() {
  const ctx = dom.grid.getContext('2d');
  ctx.clearRect(0, 0, dom.grid.width, dom.grid.height);
  drawGrid(ctx, S.doc.w, S.doc.h, dom.grid.width / S.doc.w);
}
