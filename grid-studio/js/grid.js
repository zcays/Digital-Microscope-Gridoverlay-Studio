'use strict';
/* The static grid overlay. Pure drawing code: also used for PNG export. */

const MAX_CELLS = 400000;

/** Work out where the array starts and how many whole squares fit inside the dead-space margins. */
function gridLayout(w, h) {
  const G = S.grid, size = Math.max(1, G.size);
  const pitchX = size + G.gapX, pitchY = size + G.gapY;
  if (pitchX < 1 || pitchY < 1) return null;

  const count = (avail, pitch, gap, fixed) => fixed > 0 ? fixed : Math.max(0, Math.floor((avail + gap) / pitch));
  const availW = w - G.mL - G.mR, availH = h - G.mT - G.mB;
  const cols = count(availW, pitchX, G.gapX, G.cols), rows = count(availH, pitchY, G.gapY, G.rows);
  if (cols < 1 || rows < 1) return null;

  const spareX = availW - (cols * pitchX - G.gapX), spareY = availH - (rows * pitchY - G.gapY);
  return {
    size, pitchX, pitchY, cols, rows,
    x0: G.mL + (G.center ? spareX / 2 : 0) + G.offX,
    y0: G.mT + (G.center ? spareY / 2 : 0) + G.offY,
  };
}

/** Draw the grid for a w×h canvas onto ctx; k = canvas pixels per document pixel. */
function drawGrid(ctx, w, h, k) {
  ctx.clearRect(0, 0, w * k, h * k);
  const G = S.grid; if (!G.visible) return;
  const L = gridLayout(w, h); if (!L) return;
  if (L.cols * L.rows > MAX_CELLS) return toast('Too many cells — increase the size or spacing');

  const filled = G.mode === 'filled';
  const lineW = filled ? 0 : Math.min(G.stroke, L.size / 2), inset = lineW / 2, side = L.size - lineW;
  const radius = Math.min(G.radius, side / 2), rounded = radius > 0 && typeof ctx.roundRect === 'function';

  ctx.save(); ctx.scale(k, k); ctx.globalAlpha = G.opacity; ctx.beginPath();
  for (let j = 0; j < L.rows; j++) for (let i = 0; i < L.cols; i++) {
    const x = L.x0 + i * L.pitchX + inset, y = L.y0 + j * L.pitchY + inset;
    if (rounded) ctx.roundRect(x, y, side, side, radius); else ctx.rect(x, y, side, side);
  }
  if (filled) { ctx.fillStyle = G.color; ctx.fill(); }
  else { ctx.strokeStyle = G.color; ctx.lineWidth = lineW; ctx.stroke(); }
  ctx.restore();
}

function renderGrid() { drawGrid(dom.grid.getContext('2d'), S.doc.w, S.doc.h, dom.grid.width / S.doc.w); }
