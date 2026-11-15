'use strict';
/* view.js — how the canvas is shown: stage size, VIEW zoom, pointer→canvas mapping, status bar, µm scale bar.
 * The canvases (#gl, #grid) are always canvas-sized in pixels; zoom only changes their CSS size.
 * Changing S.zoom never changes the document or the exported PNG. */

const ZOOM_MIN = .05, ZOOM_MAX = 8;

function layout() {
  const {w, h} = S.doc, z = S.zoom, cssW = w * z + 'px', cssH = h * z + 'px';
  if (dom.stage.style.width !== cssW) dom.stage.style.width = cssW;
  if (dom.stage.style.height !== cssH) dom.stage.style.height = cssH;
  for (const c of [dom.gl, dom.grid]) {
    if (c.style.width !== cssW) c.style.width = cssW;
    if (c.style.height !== cssH) c.style.height = cssH;
  }
  // The grid canvas is rendered at screen resolution so lines stay crisp when zoomed in.
  const k = Math.max(.05, Math.min(z * (window.devicePixelRatio || 1), MAX_DOC / Math.max(w, h)));
  const gw = Math.max(1, Math.round(w * k)), gh = Math.max(1, Math.round(h * k));
  if (dom.grid.width !== gw) dom.grid.width = gw;
  if (dom.grid.height !== gh) dom.grid.height = gh;
  dirtyFlags.grid = dirtyFlags.crop = dirtyFlags.warp = true;
}

function setZoom(z) {
  const ws = dom.ws, cx = (ws.scrollLeft + ws.clientWidth / 2) / S.zoom, cy = (ws.scrollTop + ws.clientHeight / 2) / S.zoom;
  S.zoom = clamp(z, ZOOM_MIN, ZOOM_MAX); dirty('layout', 'status');
  requestAnimationFrame(() => { ws.scrollLeft = cx * S.zoom - ws.clientWidth / 2; ws.scrollTop = cy * S.zoom - ws.clientHeight / 2; });
}
function fitZoom() {
  const fit = Math.min(4, (dom.ws.clientWidth - 90) / S.doc.w, (dom.ws.clientHeight - 90) / S.doc.h);
  S.zoom = Math.max(ZOOM_MIN, fit);                       // layout may not be measurable yet (fit <= 0)
  dirty('layout', 'status');
}
const zoomIn = () => setZoom(S.zoom * 1.25), zoomOut = () => setZoom(S.zoom / 1.25);

/** Pointer position in document pixels. */
function docPoint(e) {
  const r = dom.stage.getBoundingClientRect();
  return {x: (e.clientX - r.left) / S.zoom, y: (e.clientY - r.top) / S.zoom};
}

/* ---------------- status bar + µm ruler ---------------- */
const setTextIfChanged = (el, text) => { if (el && el.textContent !== text) el.textContent = text; };

function updateStatusBar() {
  const k = pxPerUm(), c = S.cursor;
  setTextIfChanged($('#sInfo'), `${S.doc.w} × ${S.doc.h} px · ${rendererName()}`);
  setTextIfChanged($('#sZoom'), Math.round(S.zoom * 100) + '%');
  setTextIfChanged($('#sPos'), !c ? '' : k ? `x ${Math.round(c.x / k)} µm  y ${Math.round(c.y / k)} µm` : `x ${Math.round(c.x)}  y ${Math.round(c.y)}`);
  updateScaleBar(k);
  updateChipInfo();
}

/** Ruler in real µm (only while a chip version is ticked): lets you check well size and spacing against the table. */
function updateScaleBar(k) {
  const bar = $('#scalebar'), disp = k ? 'block' : 'none';
  if (bar.style.display !== disp) bar.style.display = disp;
  if (!k) return;
  const um = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000].find(u => u * k * S.zoom >= 70) || 10000;
  const wPx = um * k * S.zoom + 'px', label = um >= 1000 ? um / 1000 + ' mm' : um + ' µm';
  if (bar.firstElementChild.style.width !== wPx) bar.firstElementChild.style.width = wPx;
  setTextIfChanged(bar.lastElementChild, label);
}
