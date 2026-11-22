'use strict';
/* corners.js — the "Pick corners" tool for semi-automatic (corner-assisted) Auto-fit.
 * Registers TOOLS.corners and the cornerPlace / cornerMove drag types at the bottom of this file.
 * The user clicks the outer corner of each of the four corner wells of the array (in any order).
 * Markers 1–4 are stored in SOURCE image pixels so they stay attached to the photo when it is moved,
 * zoomed, rotated or corrected, and are re-projected to canvas pixels every frame via sourceToCanvasPoint().
 * Once 4 markers are placed, pressing Enter (or clicking "Fit to these corners") calls afRunCorners(pts, onDone). */

let cornerPts = [];                       // placed markers in source image px: [{x, y}, …] (at most 4)
let cornerChipId = null;                  // chip id when markers were placed; changing chip clears them
let cornerImgEl = null;                   // image element when markers were placed; changing image clears them
let cornerHover = null;                   // last pointer position on the stage in canvas px (for the loupe)
let cornerLayer = null, cornerSvg = null, cornerPoly = null, cornerMarkerEls = [], cornerBanner = null, cornerBannerText = null, cornerFitBtn = null, cornerShapeBtn = null, cornerCancelBtn = null, cornerLoupe = null, cornerLoupeCanvas = null;

/** Current forward model parameters and geometry, honouring S.lens.bypass (via afCurrent) and S.warp.enabled. */
function cornerModel() {
  const th = afCurrent(), warped = S.warp.enabled && warpActive();
  if (!warped) for (let i = AF_WARP; i < 22; i++) th[i] = 0;
  const geo = {
    w: S.img.w, h: S.img.h, cx: S.lens.cx, cy: S.lens.cy,
    docW: S.doc.w, docH: S.doc.h,
    mesh: warped ? S.warp.mesh : null,
  };
  return {th, geo, fw: afForward(th, geo)};
}

/** Map a point in SOURCE image pixels (sx, sy) → CANVAS pixels {x, y} through the full current image model. */
function sourceToCanvasPoint(sx, sy) {
  if (!S.img.el) return {x: sx, y: sy};
  const {fw} = cornerModel(), out = [0, 0, 0, 0];
  fw(sx, sy, out);
  return {x: out[0], y: out[1]};
}

/** Map a point in CANVAS pixels (x, y) → SOURCE image pixels {x, y} by inverting afForward(afCurrent(), geo).
 *  Uses an exact analytic inverse of the pass-1 (similarity + radial lens) as the starting guess, followed by
 *  damped Newton iterations with a finite-difference Jacobian on the full forward model (including 8-handle warp + fine mesh). */
function canvasToSourcePoint(x, y) {
  if (!S.img.el) return {x, y};
  const {th, geo, fw} = cornerModel(), out = [0, 0, 0, 0], outX = [0, 0, 0, 0], outY = [0, 0, 0, 0];
  // Robust initial guess: unwarp on the canvas if distortion is active, then invert translate/rotate/scale + radial lens.
  let ux = x, uy = y;
  if (S.warp.enabled && warpActive()) [ux, uy] = unwarpCanvasPoint(x, y);
  const a = -th[AF_ROT] * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a), sc = th[AF_SCALE] || 1;
  const icx = th[AF_X] + geo.w * sc / 2, icy = th[AF_Y] + geo.h * sc / 2;
  const dx = ux - icx, dy = uy - icy;
  const qx = (cs * dx - sn * dy) / sc + geo.w / 2, qy = (sn * dx + cs * dy) / sc + geo.h / 2;
  const lcx = geo.cx * geo.w, lcy = geo.cy * geo.h, R = .5 * Math.hypot(geo.w, geo.h) || 1;
  const nx = (qx - lcx) / R, ny = (qy - lcy) / R, r2 = nx * nx + ny * ny;
  const f = 1 - th[AF_K1] * r2 - th[AF_K2] * r2 * r2;
  let sx = lcx + nx * f * R, sy = lcy + ny * f * R;

  // Newton refinement on the exact forward model fw(sx, sy).
  const eps = 1e-3;
  for (let iter = 0; iter < 14; iter++) {
    fw(sx, sy, out);
    const ex = x - out[0], ey = y - out[1], err = Math.hypot(ex, ey);
    if (err < 1e-6) break;
    fw(sx + eps, sy, outX); fw(sx, sy + eps, outY);
    const j00 = (outX[0] - out[0]) / eps, j10 = (outX[1] - out[1]) / eps;
    const j01 = (outY[0] - out[0]) / eps, j11 = (outY[1] - out[1]) / eps;
    const det = j00 * j11 - j01 * j10;
    if (Math.abs(det) < 1e-12) break;
    const dsx = (j11 * ex - j01 * ey) / det, dsy = (j00 * ey - j10 * ex) / det;
    // Line-search damping if a full step overshoots on a steep lens/mesh edge.
    let step = 1, nsx = sx + dsx, nsy = sy + dsy;
    for (let ls = 0; ls < 4; ls++) {
      fw(nsx, nsy, outX);
      if (Math.hypot(x - outX[0], y - outX[1]) <= err * (1 + 1e-4)) break;
      step *= .5; nsx = sx + dsx * step; nsy = sy + dsy * step;
    }
    sx = nsx; sy = nsy;
    if (Math.hypot(dsx * step, dsy * step) < 1e-6) break;
  }
  return {x: sx, y: sy};
}

/** Clear all placed corner markers and refresh the UI. */
function clearCorners() {
  cornerPts.length = 0;
  cornerChipId = S.chip.id;
  cornerImgEl = S.img.el;
  updateCornersUI();
}

/** Ensure markers belong to the currently loaded image and ticked chip; if either changed, discard old markers. */
function checkCornersContext() {
  if (cornerImgEl !== S.img.el || cornerChipId !== S.chip.id) {
    cornerPts.length = 0;
    cornerImgEl = S.img.el;
    cornerChipId = S.chip.id;
    if (S.tool === 'corners' && (!S.img.el || !activePreset())) setTool('move');
  }
}

/** Tell the user plainly why Pick corners cannot be entered right now. */
function cornerSay(msg) {
  toast(msg);
  const info = $('#autoFitInfo');
  if (info) info.textContent = msg;
}

/** Enter the Pick corners tool if an image is loaded and a chip version is ticked; otherwise explain why. */
function startCornerPick() {
  if (!S.img.el) { cornerSay('Load an image first.'); return false; }
  if (!activePreset()) { cornerSay('Tick the chip version first, so I know which grid to fit.'); return false; }
  checkCornersContext();
  if (S.tool !== 'corners') setTool('corners');
  else updateCornersUI();
  return true;
}

/** Cancel the Pick corners tool: clear placed markers and return to the Move tool. */
function cancelCornerPick() {
  if (S.tool === 'corners') setTool('move');
  clearCorners();
}

/** Remove the last placed marker (Backspace / Delete). */
function removeLastCorner() {
  if (!cornerPts.length) return;
  cornerPts.pop();
  updateCornersUI();
  refresh('warp', 'status');
}

/** Cyclic order of the 4 points around their centroid so the outline forms a non-self-intersecting quad. */
function orderedQuadPoints(pts) {
  if (pts.length < 4) return pts;
  const cx = (pts[0].x + pts[1].x + pts[2].x + pts[3].x) / 4;
  const cy = (pts[0].y + pts[1].y + pts[2].y + pts[3].y) / 4;
  return pts.slice().sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
}

/** Run corner-assisted Auto-fit on the 4 placed markers. */
function runCornerFit(preserveShape = false) {
  if (!S.img.el) { cornerSay('Load an image first.'); return; }
  if (!activePreset()) { cornerSay('Tick the chip version first, so I know which grid to fit.'); return; }
  if (cornerPts.length !== 4) { cornerSay('Place all 4 corner markers first (1 in each corner well of the array).'); return; }
  if (typeof afRunCorners !== 'function') {
    cornerSay('Corner-assisted fitting is not available in this build.');
    return;
  }
  const pts = cornerPts.map(p => ({x: p.x, y: p.y}));
  afRunCorners(pts, res => {
    if (res && res.ok) {
      clearCorners();
      if (S.tool === 'corners') setTool('move');
    } else {
      updateCornersUI();
    }
    syncAll();
  }, preserveShape);
}

/* ---------------- on-canvas overlay (outline, 4 numbered markers, floating instruction, magnifier loupe) ---------------- */
function buildCornersOverlay() {
  if (cornerLayer) return;
  cornerLayer = document.createElement('div');
  cornerLayer.id = 'cornerlayer';

  cornerSvg = document.createElementNS(SVG_NS, 'svg');
  cornerSvg.id = 'cornersvg';
  cornerPoly = document.createElementNS(SVG_NS, 'polygon');
  cornerSvg.append(cornerPoly);
  cornerLayer.append(cornerSvg);

  for (let i = 0; i < 4; i++) {
    const m = document.createElement('div');
    m.className = 'cm';
    m.dataset.c = String(i);
    m.title = `Corner ${i + 1} — drag to adjust`;
    m.innerHTML = `<span class="cm-ring"></span><span class="cm-tag">${i + 1}</span>`;
    cornerLayer.append(m);
    cornerMarkerEls.push(m);
  }
  dom.stage.append(cornerLayer);

  // Loupe magnifier attached to the stage (pointer-events: none so it never blocks clicks)
  cornerLoupe = document.createElement('div');
  cornerLoupe.id = 'cornerLoupe';
  cornerLoupeCanvas = document.createElement('canvas');
  cornerLoupeCanvas.width = 116;
  cornerLoupeCanvas.height = 116;
  const cross = document.createElement('div');
  cross.className = 'loupe-cross';
  const badge = document.createElement('div');
  badge.className = 'loupe-badge';
  badge.textContent = '3.5×';
  cornerLoupe.append(cornerLoupeCanvas, cross, badge);
  dom.stage.append(cornerLoupe);

  // Floating instruction bar at top of workspace
  cornerBanner = document.createElement('div');
  cornerBanner.id = 'cornerBanner';
  cornerBannerText = document.createElement('span');
  cornerBannerText.id = 'cornerBannerText';
  cornerFitBtn = document.createElement('button');
  cornerFitBtn.id = 'cornerFit';
  cornerFitBtn.className = 'primary';
  cornerFitBtn.textContent = 'Fit to these corners';
  cornerFitBtn.onclick = () => runCornerFit();
  cornerShapeBtn = document.createElement('button');
  cornerShapeBtn.id = 'cornerShape';
  cornerShapeBtn.textContent = 'Preserve shape';
  cornerShapeBtn.title = 'Align the four corners using only rotation, uniform scale and position';
  cornerShapeBtn.onclick = () => runCornerFit(true);
  cornerCancelBtn = document.createElement('button');
  cornerCancelBtn.id = 'cornerCancel';
  cornerCancelBtn.textContent = 'Cancel';
  cornerCancelBtn.onclick = () => cancelCornerPick();
  cornerBanner.append(cornerBannerText, cornerFitBtn, cornerShapeBtn, cornerCancelBtn);
  $("#app").append(cornerBanner);

  // Track pointer for the loupe and wire updateCornersUI into the redraw & sync loops.
  dom.stage.addEventListener('pointermove', e => {
    cornerHover = docPoint(e);
    if (S.tool === 'corners') updateCornerLoupe();
  });
  dom.stage.addEventListener('pointerleave', () => {
    cornerHover = null;
    if (cornerLoupe) cornerLoupe.style.display = 'none';
  });
  const origRenderImage = renderImage;
  renderImage = function (opts) {
    origRenderImage(opts);
    if (cornerPts.length || S.tool === 'corners') updateCornersUI();
  };
  const origSetTool = setTool;
  setTool = function (name) {
    origSetTool(name);
    if (cornerLayer || name === 'corners' || cornerPts.length) updateCornersUI();
  };
}

function updateCornerLoupe() {
  if (!cornerLoupe) return;
  const show = S.tool === 'corners' && S.img.el && !!cornerHover;
  if (!show) { cornerLoupe.style.display = 'none'; return; }
  cornerLoupe.style.display = 'block';

  const z = S.zoom, sx = cornerHover.x * z, sy = cornerHover.y * z;
  const W = S.doc.w * z, H = S.doc.h * z, L = 116, pad = 18;
  // Offset the loupe so it stays inside the stage / viewport and never covers the crosshair
  let lx = sx + pad, ly = sy - L - pad;
  if (lx + L > W - 4) lx = sx - L - pad;
  if (ly < 4) ly = sy + pad;
  lx = clamp(lx, 4, Math.max(4, W - L - 4));
  ly = clamp(ly, 4, Math.max(4, H - L - 4));
  cornerLoupe.style.left = Math.round(lx) + 'px';
  cornerLoupe.style.top = Math.round(ly) + 'px';

  // Draw 3.5× magnified view of the displayed image around cornerHover
  const mag = 3.5, cw = cornerLoupeCanvas.width, ch = cornerLoupeCanvas.height;
  const ctx = cornerLoupeCanvas.getContext('2d');
  ctx.clearRect(0, 0, cw, ch);
  ctx.fillStyle = '#181818';
  ctx.fillRect(0, 0, cw, ch);
  const glCanvas = dom.gl;
  if (glCanvas && glCanvas.width > 0 && glCanvas.height > 0) {
    const kx = glCanvas.width / S.doc.w, ky = glCanvas.height / S.doc.h;
    // Span in canvas px corresponding to cw / (mag * S.zoom) so the loupe is 3.5× of the on-screen picture
    const spanDocW = cw / (mag * Math.max(.25, S.zoom)), spanDocH = ch / (mag * Math.max(.25, S.zoom));
    const srcX = (cornerHover.x - spanDocW / 2) * kx, srcY = (cornerHover.y - spanDocH / 2) * ky;
    const srcW = spanDocW * kx, srcH = spanDocH * ky;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(glCanvas, srcX, srcY, srcW, srcH, 0, 0, cw, ch);
    // Also draw any already-placed markers that fall inside the loupe view
    for (let i = 0; i < cornerPts.length; i++) {
      const cp = sourceToCanvasPoint(cornerPts[i].x, cornerPts[i].y);
      const mx = (cp.x - (cornerHover.x - spanDocW / 2)) / spanDocW * cw;
      const my = (cp.y - (cornerHover.y - spanDocH / 2)) / spanDocH * ch;
      if (mx >= -10 && mx <= cw + 10 && my >= -10 && my <= ch + 10) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(mx, my, 5, 0, Math.PI * 2); ctx.stroke();
      }
    }
  }
}

function updateCornersUI() {
  if (!cornerLayer) buildCornersOverlay();
  checkCornersContext();
  const active = S.tool === 'corners' && !!S.img.el && !!activePreset();
  cornerLayer.style.display = active ? 'block' : 'none';
  cornerBanner.style.display = active ? 'flex' : 'none';
  cornerFitBtn.disabled = cornerShapeBtn.disabled = cornerPts.length !== 4;
  const pickBtn = $('#cornerPick');
  if (pickBtn) {
    pickBtn.disabled = !S.chip.id || !S.img.el;
    pickBtn.classList.toggle('on', active);
  }
  const n = cornerPts.length, z = S.zoom;
  const canvasPts = S.img.el ? cornerPts.map(p => sourceToCanvasPoint(p.x, p.y)) : [];
  for (let i = 0; i < 4; i++) {
    const el = cornerMarkerEls[i];
    if (i < n && canvasPts[i]) {
      el.style.display = active ? 'block' : 'none';
      el.style.left = (canvasPts[i].x * z).toFixed(1) + 'px';
      el.style.top = (canvasPts[i].y * z).toFixed(1) + 'px';
    } else {
      el.style.display = 'none';
    }
  }
  if (!active) {
    if (cornerLoupe) cornerLoupe.style.display = 'none';
    return;
  }
  const wsRect = dom.ws.getBoundingClientRect();
  if (wsRect.height > 0) {
    cornerBanner.style.top = Math.max(8, Math.round(wsRect.top + 8)) + 'px';
    cornerBanner.style.left = Math.round(wsRect.left + 8) + 'px';
    cornerBanner.style.right = Math.max(8, Math.round(window.innerWidth - wsRect.right + 8)) + 'px';
    cornerBanner.style.maxWidth = Math.max(200, Math.round(wsRect.width - 16)) + 'px';
  }
  cornerBannerText.textContent = n < 4
    ? `Click the outer corner of each corner well — ${n} of 4. Drag to adjust · Enter to fit · Esc to cancel`
    : 'All 4 corner wells marked — drag to adjust · Enter to fit · Backspace removes last · Esc to cancel';
  if (n === 4) {
    const ord = orderedQuadPoints(canvasPts);
    cornerPoly.setAttribute('points', ord.map(p => `${(p.x * z).toFixed(1)},${(p.y * z).toFixed(1)}`).join(' '));
    cornerSvg.style.display = 'block';
  } else {
    cornerSvg.style.display = 'none';
  }
  updateCornerLoupe();
}

/* ---------------- tool + mouse drags (registered into the registries in state.js) ---------------- */
const cornerHandleIndex = e => {
  const el = e.target && e.target.closest ? e.target.closest('.cm') : null;
  if (el && el.dataset && el.dataset.c !== undefined) return +el.dataset.c;
  if (e.target && e.target.dataset && e.target.dataset.c !== undefined) return +e.target.dataset.c;
  return -1;
};

/** Hit-test existing markers in screen pixels (~12 px radius) so dragging works even when dispatching events directly on #stage. */
function pickNearestCornerIndex(p) {
  const hitRadius = 12 / Math.max(.25, S.zoom);
  let best = -1, bestD = hitRadius;
  for (let i = 0; i < cornerPts.length; i++) {
    const cp = sourceToCanvasPoint(cornerPts[i].x, cornerPts[i].y);
    const d = Math.hypot(cp.x - p.x, cp.y - p.y);
    if (d <= bestD) { bestD = d; best = i; }
  }
  return best;
}

TOOLS.corners = {
  cursor: 'crosshair',
  enter() {
    if (!S.img.el || !activePreset()) {
      cornerSay(!S.img.el ? 'Load an image first.' : 'Tick the chip version first, so I know which grid to fit.');
      setTool('move');
      return;
    }
    checkCornersContext();
    updateCornersUI();
  },
  pick(e, p) {
    if (!activePreset()) return null;
    const idx = cornerHandleIndex(e);
    if (idx >= 0 && idx < cornerPts.length) return 'cornerMove';
    const nearIdx = pickNearestCornerIndex(p);
    if (nearIdx >= 0) return 'cornerMove';
    if (cornerPts.length < 4) return 'cornerPlace';
    return null;
  },
};

Object.assign(dragTypes, {
  cornerPlace: {
    start: (e, p) => {
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) cornerHover = {x: p.x, y: p.y};
      const sp = canvasToSourcePoint(p.x, p.y);
      cornerPts.push(sp);
      const index = cornerPts.length - 1;
      updateCornersUI();
      return {index};
    },
    move: (d, e, p) => {
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) cornerHover = {x: p.x, y: p.y};
      if (d.index >= 0 && d.index < cornerPts.length) {
        cornerPts[d.index] = canvasToSourcePoint(p.x, p.y);
        updateCornersUI();
      }
    },
  },
  cornerMove: {
    start: (e, p) => {
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) cornerHover = {x: p.x, y: p.y};
      let index = cornerHandleIndex(e);
      if (index < 0 || index >= cornerPts.length) index = pickNearestCornerIndex(p);
      return {index};
    },
    move: (d, e, p) => {
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) cornerHover = {x: p.x, y: p.y};
      if (d.index >= 0 && d.index < cornerPts.length) {
        cornerPts[d.index] = canvasToSourcePoint(p.x, p.y);
        updateCornersUI();
      }
    },
  },
});

// Hook into updateWarpUI and syncs so every frame or state sync also updates the corner markers.
{
  const origUpdateWarpUI = updateWarpUI;
  updateWarpUI = function () {
    origUpdateWarpUI();
    updateCornersUI();
  };
  syncs.push(() => updateCornersUI());
  addEventListener('keydown', e => {
    if (S.tool !== 'corners') return;
    const t = e.target, tag = t.tagName, inField = tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA';
    const typing = tag === 'TEXTAREA' || tag === 'SELECT' || (tag === 'INPUT' && ['number', 'text'].includes(t.type));
    if (e.key === 'Escape' && !helpOpen() && !inField) {
      e.preventDefault(); e.stopPropagation();
      cancelCornerPick();
      return;
    }
    if (typing || inField || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault(); e.stopPropagation();
      removeLastCorner();
    } else if (e.key === 'Enter' && tag !== 'BUTTON') {
      e.preventDefault(); e.stopPropagation();
      runCornerFit();
    }
  }, true);
}
