'use strict';
/* Stage sizing and zoom. The canvases are document-sized; zoom is applied with CSS size. */

const ZOOM_MIN = .05, ZOOM_MAX = 8;

function layout() {
  const {w, h} = S.doc, z = S.zoom;
  dom.stage.style.width = w * z + 'px'; dom.stage.style.height = h * z + 'px';
  for (const c of [dom.gl, dom.grid]) { c.style.width = w * z + 'px'; c.style.height = h * z + 'px'; }
  // The grid canvas is rendered at screen resolution so lines stay crisp when zoomed in.
  const k = Math.max(.05, Math.min(z * (window.devicePixelRatio || 1), MAX_DOC / Math.max(w, h)));
  dom.grid.width = Math.max(1, Math.round(w * k)); dom.grid.height = Math.max(1, Math.round(h * k));
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
