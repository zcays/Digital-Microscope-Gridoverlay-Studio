'use strict';
/* Chip versions (from the well-geometry table) and the physical scale they imply.
 * All lengths are in µm. pitch = well size + top wall width, and wide × pitch ≈ array width. */

const CHIPS = [
  {id: 'V1-Square', shape: 'square', bottom: '12% draft angle', draft: 12,   pitch: 500, well: 470, wall: 30, depth: 400, widthUm: 19500, lengthUm: 9500,  wide: 39,  long: 19},
  {id: 'V3.1',      shape: 'square', bottom: 'square',          draft: 0,    pitch: 200, well: 170, wall: 30, depth: 400, widthUm: 8000,  lengthUm: 8000,  wide: 40,  long: 40},
  {id: 'V3.2',      shape: 'square', bottom: 'radius 20 µm',    draft: null, pitch: 200, well: 170, wall: 30, depth: 50,  widthUm: 8000,  lengthUm: 8000,  wide: 40,  long: 40},
  {id: 'V7.0',      shape: 'square', bottom: 'square',          draft: 0,    pitch: 100, well: 50,  wall: 50, depth: 50,  widthUm: 8000,  lengthUm: 8000,  wide: 80,  long: 80},
  {id: 'V9.0',      shape: 'circle', bottom: 'square',          draft: 0,    pitch: 60,  well: 50,  wall: 10, depth: 50,  widthUm: 20000, lengthUm: 18000, wide: 333, long: 300},
  {id: 'V9.1',      shape: 'circle', bottom: 'square',          draft: 0,    pitch: 60,  well: 50,  wall: 10, depth: 50,  widthUm: 7500,  lengthUm: 7500,  wide: 125, long: 125},
  {id: 'V9.2',      shape: 'circle', bottom: 'square',          draft: 0,    pitch: 60,  well: 50,  wall: 10, depth: 50,  widthUm: 10000, lengthUm: 9000,  wide: 166, long: 150},
  {id: 'V10.2',     shape: 'square', bottom: 'radius 20 µm',    draft: 0,    pitch: 120, well: 80,  wall: 40, depth: 200, widthUm: 8000,  lengthUm: 8000,  wide: 66,  long: 66},
  {id: 'V11',       shape: 'square', bottom: 'draft angle 5%',  draft: 5,    pitch: 120, well: 80,  wall: 40, depth: 200, widthUm: 10000, lengthUm: 10000, wide: 83,  long: 83},
  {id: 'V12',       shape: 'square', bottom: 'draft angle 5%',  draft: 5,    pitch: 200, well: 170, wall: 30, depth: 200, widthUm: 10000, lengthUm: 10000, wide: 49,  long: 49},
  {id: 'V15.1',     shape: 'square', bottom: 'draft angle 5%',  draft: 5,    pitch: 75,  well: 50,  wall: 25, depth: 100, widthUm: 10000, lengthUm: 10000, wide: 133, long: 133},
  {id: 'V15.2',     shape: 'square', bottom: 'draft angle 5%',  draft: 5,    pitch: 100, well: 50,  wall: 50, depth: 100, widthUm: 10000, lengthUm: 10000, wide: 100, long: 100},
];

const AUTO_PITCH_PX = 48;                   // at 100 % grid zoom one well pitch is drawn this many canvas px wide

const activePreset = () => S.chip.id ? CHIPS.find(c => c.id === S.chip.id) : null;
/** Canvas pixels per µm for the active chip (null when no chip is ticked). */
const pxPerUm = () => { const P = activePreset(); return P ? AUTO_PITCH_PX / P.pitch * S.chip.zoom / 100 : null; };
/** Current image calibration in µm per image pixel (null without chip or image). */
const umPerPx = () => { const k = pxPerUm(); return k && S.img.el ? S.img.scale / k : null; };

/** Run `change`, then rescale the image so its µm-per-pixel stays the same (the microscope doesn't change). */
function keepingImageScale(change) {
  const u = umPerPx();
  change();
  const k = pxPerUm();
  if (u && k) S.img.scale = u * k;
  refresh('gl', 'grid', 'status');
}
function selectChip(id) { keepingImageScale(() => S.chip.id = id); }
function setChipZoom(pct) { keepingImageScale(() => S.chip.zoom = clamp(pct, 5, 5000)); }
function setImageUmPerPx(v) { const k = pxPerUm(); if (!k || !(v > 0)) return; S.img.scale = v * k; dirty('gl'); }

function updateChipInfo() {
  const el = $('#chipInfo'), P = activePreset();
  if (!el) return;
  if (!P) { el.textContent = 'No chip ticked: the grid uses the manual settings below.'; return; }
  const k = pxPerUm(), u = umPerPx();
  el.innerHTML = [
    `<b>${P.id}</b> · ${P.shape} wells · bottom: ${P.bottom}${P.draft ? ` · draft ${P.draft}` : ''}`,
    `pitch ${P.pitch} µm · well ${P.well} µm · wall ${P.wall} µm · depth ${P.depth} µm`,
    `array ${P.widthUm} × ${P.lengthUm} µm (${P.wide} × ${P.long} wells)`,
    `<b>Scale:</b> ${k.toFixed(3)} px/µm → pitch ${(P.pitch * k).toFixed(1)} px, well ${(P.well * k).toFixed(1)} px`,
    `Canvas shows ${Math.round(S.doc.w / k)} × ${Math.round(S.doc.h / k)} µm`,
    u ? `<b>Image: ${u.toFixed(3)} µm per pixel</b>` : '',
  ].filter(Boolean).join('<br>');
}
