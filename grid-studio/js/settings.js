'use strict';
/* settings.js — portable alignment files (data only, never image pixels).
 * settingsSnapshot / settingsToText have no side effects; parseSettings validates and copies only known fields.
 * applySettings validates again, checks the live chip list BEFORE touching S, then restores chip/canvas before image maths.
 * A file loaded before its picture waits for one setImage() call. No browser storage or local-file fetch is used.
 * Dragged warp points and image crop coordinates have no UI bounds; all must still be finite. */

const SETTINGS_APP = 'Digital Microscope Gridoverlay Studio';
let waitingSettings = null, settingsSource = '';
const settingsCopy = v => JSON.parse(JSON.stringify(v));

function settingsSnapshot() {
  const I = S.img, C = S.chip;
  return {
    app: SETTINGS_APP, kind: 'grid-studio-settings', version: 1, savedAt: new Date().toISOString(),
    image: I.el ? {name: I.name, width: I.w, height: I.h} : null,
    canvas: {...S.doc},
    chip: {id: C.id, fit: C.fit, margin: C.margin, arrayOnly: C.arrayOnly,
      arrayPad: C.arrayPad, cropAfterFit: C.cropAfterFit,
      savedDoc: C.savedDoc ? {...C.savedDoc} : null, definition: activePreset() ? settingsCopy(activePreset()) : null},
    img: {x: I.x, y: I.y, scale: I.scale, rot: I.rot, crop: I.crop ? {...I.crop, rot: I.crop.rot || 0} : null},
    lens: {...S.lens}, warp: settingsCopy(S.warp), grid: {...S.grid}, ratio: S.ratio,
    export: {image: $('#exImg').checked, grid: $('#exGrid').checked},
  };
}
function settingsToText(obj) { return JSON.stringify(obj, null, 2) + '\n'; }

/** Pure, strict validator. Do not JSON-copy the input first: that would silently turn NaN into null. */
function validateSettings(raw) {
  const fail = msg => { throw new Error(msg); };
  const object = (v, label) => {
    if (!v || typeof v !== 'object' || Array.isArray(v)) fail(`${label} must be a group of settings.`);
    return v;
  };
  const number = (v, label, lo = -Infinity, hi = Infinity) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) fail(`${label} must be a finite number.`);
    if (v < lo || v > hi) fail(`${label} must be between ${lo} and ${hi}.`);
    return v;
  };
  const bool = (v, label) => { if (typeof v !== 'boolean') fail(`${label} must be true or false.`); return v; };
  const text = (v, label) => { if (typeof v !== 'string') fail(`${label} must be text.`); return v; };
  const choice = (v, values, label) => { if (!values.includes(v)) fail(`${label} is not a recognised choice.`); return v; };
  const canvas = (v, label) => { object(v, label); return {w: clamp(Math.round(number(v.w, `${label} width`)), 16, MAX_DOC), h: clamp(Math.round(number(v.h, `${label} height`)), 16, MAX_DOC)}; };
  const point = (v, label) => { object(v, label); return {x: number(v.x, `${label} X`), y: number(v.y, `${label} Y`)}; };
  object(raw, 'The settings file');
  if (raw.kind !== 'grid-studio-settings') fail('This is not a Grid Studio settings file. Choose a file made with “Save settings…”.');
  number(raw.version, 'Settings version', 1);
  if (raw.version > 1) fail('This file was saved by a newer version of the studio. Open it with that version.');
  if (raw.version !== 1) fail('This settings version is not supported.');
  if (raw.app !== SETTINGS_APP) fail('This settings file belongs to a different app.');
  const savedAt = text(raw.savedAt, 'Saved time');
  if (!/^\d{4}-\d\d-\d\dT/.test(savedAt) || !Number.isFinite(Date.parse(savedAt))) fail('The saved time is not a valid date.');
  let image = null;
  if (raw.image !== null) {
    const i = object(raw.image, 'Image details');
    image = {name: text(i.name, 'Image file name'), width: number(i.width, 'Image width', 1, MAX_DOC), height: number(i.height, 'Image height', 1, MAX_DOC)};
    if (!Number.isInteger(image.width) || !Number.isInteger(image.height)) fail('Image size must be whole pixels.');
  }
  const c = object(raw.chip, 'Chip settings');
  const id = c.id === null ? null : text(c.id, 'Chip name');
  if (id === '') fail('The chip name is empty.');
  let definition = null;
  if (id !== null) {
    const d = object(c.definition, 'Saved chip details');
    if (d.id !== id) fail('The saved chip name does not match its details.');
    choice(d.shape, ['square', 'circle'], 'Saved well shape');
    const labels = {well:'well size', pitch:'pitch', wall:'wall width', wide:'wells wide', long:'wells long', widthUm:'array width', lengthUm:'array length'};
    for (const [k, label] of Object.entries(labels)) number(d[k], `Saved chip ${label}`, 0);
    for (const k of ['draft', 'depth']) if (d[k] !== null) number(d[k], `Saved chip ${k}`);
    text(d.bottom, 'Saved chip bottom');
    const checked = validateChips([d]);
    if (checked.errors.length || !checked.chips.length) fail(checked.errors[0] || 'The saved chip details are not valid.');
    definition = checked.chips[0];
  } else if (c.definition !== null) fail('Chip details need a chip name.');
  const ARRAY_PADS = ['halfWell', 'halfWall', 'none'];
  const chip = {id, fit: bool(c.fit, 'Fit canvas to array'), margin: clamp(number(c.margin, 'Dead room'), 0, 40),
    arrayOnly: bool(c.arrayOnly, 'Crop to array'),
    arrayPad: c.arrayPad === undefined ? 'halfWall' : choice(c.arrayPad, ARRAY_PADS, 'Space around the array'),
    cropAfterFit: c.cropAfterFit === undefined ? true : bool(c.cropAfterFit, 'Crop to array after Auto-fit'),
    savedDoc: c.savedDoc === null ? null : canvas(c.savedDoc, 'Previous canvas'), definition};
  if (chip.arrayOnly && (!id || !chip.fit)) fail('“Crop to array” needs a ticked chip with “Fit canvas to array”.');
  const i = object(raw.img, 'Image settings'), l = object(raw.lens, 'Lens settings'), w = object(raw.warp, 'Distortion settings');
  // Limits here are sanity bounds, deliberately wider than the sliders: Auto-fit and typed values may legitimately go beyond a slider's
  // travel (a small photo on a 2000 px canvas needs a scale above 400%), and a file the studio saved itself must always load again.
  const img = {x: number(i.x, 'Image position X', -1e5, 1e5), y: number(i.y, 'Image position Y', -1e5, 1e5),
    scale: number(i.scale, 'Image scale', .001, 100), rot: number(i.rot, 'Image rotation', -180, 180), crop: null};
  if (i.crop !== null) {
    const r = object(i.crop, 'Image crop');
    img.crop = {...point(r, 'Image crop'), w: number(r.w, 'Crop width'), h: number(r.h, 'Crop height'), rot: number(r.rot, 'Crop rotation', -180, 180)};
    if (r.w <= 0 || r.h <= 0) fail('Crop width and height must be greater than zero.');
  }
  const lens = {k1: number(l.k1, 'Lens strength', -5, 5), k2: number(l.k2, 'Lens edge falloff', -5, 5),
    cx: number(l.cx, 'Lens centre X', 0, 1), cy: number(l.cy, 'Lens centre Y', 0, 1), bypass: bool(l.bypass, 'Before / after')};
  const warp = {enabled: bool(w.enabled, 'Apply distortion'), c: {}, dev: {}, mesh: null};
  object(w.c, 'Distortion corners'); object(w.dev, 'Distortion edges');
  for (const k of CORNERS) warp.c[k] = point(w.c[k], 'Distortion corner');
  for (const k of SIDES) warp.dev[k] = point(w.dev[k], 'Distortion edge');
  if (w.mesh !== null) {
    const m = object(w.mesh, 'Fine correction'), n = number(m.n, 'Fine correction size', 2, 33);
    if (!Number.isInteger(n) || !Array.isArray(m.d) || m.d.length !== 2 * n * n) fail('The fine correction has the wrong number of points.');
    warp.mesh = {n, d: Array.from(m.d, v => number(v, 'Fine correction offset'))};
  }
  const g = object(raw.grid, 'Grid settings'), grid = {};
  for (const k of ['visible', 'center']) grid[k] = bool(g[k], `Grid ${k === 'visible' ? 'visibility' : 'centring'}`);
  grid.mode = choice(g.mode, ['outline', 'filled'], 'Grid style'); grid.shape = choice(g.shape, ['square', 'circle'], 'Well shape');
  grid.color = text(g.color, 'Grid colour');
  if (!/^#(?:[\da-f]{3}|[\da-f]{4}|[\da-f]{6}|[\da-f]{8})$/i.test(grid.color)) fail('Grid colour must be a hex colour, such as #ffffff.');
  const limits = {opacity: [0, 1], size: [1, 8192], gapX: [0, 8192], gapY: [0, 8192], mL: [0, 8192], mR: [0, 8192], mT: [0, 8192], mB: [0, 8192], offX: [-1e5, 1e5], offY: [-1e5, 1e5], cols: [0, 8192], rows: [0, 8192], radius: [0, 4096], stroke: [.25, 200]};   // the setters only enforce the lower ends
  const labels = {opacity:'Opacity', size:'Well size', gapX:'Horizontal spacing', gapY:'Vertical spacing', mL:'Space left', mR:'Space right', mT:'Space top', mB:'Space bottom', offX:'Grid offset X', offY:'Grid offset Y', cols:'Columns', rows:'Rows', radius:'Corner radius', stroke:'Line width'};
  for (const [k, range] of Object.entries(limits)) grid[k] = number(g[k], labels[k], ...range);
  grid.cols = Math.round(grid.cols); grid.rows = Math.round(grid.rows);
  const ex = object(raw.export, 'Export choices');
  return {app: SETTINGS_APP, kind: raw.kind, version: 1, savedAt, image, canvas: canvas(raw.canvas, 'Canvas'), chip, img, lens, warp, grid,
    ratio: choice(raw.ratio, ASPECTS.map(a => a[1]), 'Crop aspect'), export: {image: bool(ex.image, 'Export image'), grid: bool(ex.grid, 'Export grid')}};
}
function parseSettings(text) {
  let raw;
  try { raw = JSON.parse(text); } catch (_) { throw new Error('Could not read this settings file. Choose a complete JSON file saved by the studio.'); }
  return {settings: validateSettings(raw)};
}

function settingsMessage(message) { $('#settingsInfo').textContent = message; toast(message); }
function settingsSummary(s, outcome) {
  return `${settingsSource || 'Settings'} · saved ${new Date(s.savedAt).toLocaleString()}. ${outcome}`;
}
/** Atomic for invalid files: all validation and chip checks happen before any mutation or panel refresh. */
function applySettings(raw) {
  let s;
  try { s = validateSettings(raw); } catch (e) { return {ok: false, reason: e.message}; }
  const P = s.chip.id === null ? null : CHIPS.find(c => c.id === s.chip.id), warnings = [];
  if (s.chip.id !== null && !P) return {ok: false, reason: `Chip “${s.chip.id}” is missing. Use “Load chip list…” in the Chip version panel first, then load these settings again.`};
  if (P && ['shape', 'well', 'pitch', 'wide', 'long'].some(k => P[k] !== s.chip.definition[k]))
    warnings.push(`Chip “${P.id}” has different well or array measurements in the current chip list. Check the alignment.`);
  if (S.img.el && s.image) {
    if (S.img.w !== s.image.width || S.img.h !== s.image.height)
      warnings.push(`This alignment was made for a different-sized picture (${s.image.width} × ${s.image.height} px); the open picture is ${S.img.w} × ${S.img.h} px. Check the alignment.`);
    else if (S.img.name !== s.image.name) warnings.push(`The image file name is different: these settings were saved with “${s.image.name}”.`);
  }
  // Presets may resize the canvas and rescale the image. Restore the exact saved values AFTER that work.
  keepingImageScale(() => Object.assign(S.chip, {id: s.chip.id, fit: s.chip.fit, margin: s.chip.margin}));
  Object.assign(S.doc, s.canvas);
  Object.assign(S.chip, {savedDoc: s.chip.savedDoc, arrayOnly: s.chip.arrayOnly, arrayPad: s.chip.arrayPad, cropAfterFit: s.chip.cropAfterFit});
  Object.assign(S.img, s.img); Object.assign(S.lens, s.lens); Object.assign(S.warp, s.warp); Object.assign(S.grid, s.grid);
  S.ratio = s.ratio; S.crop = null; undoStack.length = 0; afUndoState = null;
  $('#exImg').checked = s.export.image; $('#exGrid').checked = s.export.grid;
  waitingSettings = S.img.el ? null : s;
  // A focused number field normally defers sync while typing; loading a file must update it too.
  if (document.activeElement && document.activeElement.matches('input,select')) document.activeElement.blur();
  updateUndoButton(); refresh('gl', 'grid', 'layout', 'crop', 'warp', 'status');
  updateArrayMask();
  settingsMessage(settingsSummary(s, `${waitingSettings ? `Now open ${s.image && s.image.name || 'the image'}.` : 'Settings loaded.'} ${warnings.join(' ')}`));
  return {ok: true, warnings};
}
function applyWaitingSettings() {
  if (!waitingSettings) return;
  const s = waitingSettings; waitingSettings = null;               // used once, even if the chip list has changed since loading
  const result = applySettings(s);
  if (!result.ok) settingsMessage(result.reason);
}
function settingsFileName() {
  const name = S.img.el && S.img.name;
  return name ? `${name.replace(/\.[^.]+$/, '') || name}.gridstudio.json` : 'grid-studio-settings.json';
}
function saveSettings() {
  const s = waitingSettings ? {...settingsCopy(waitingSettings), savedAt: new Date().toISOString()} : settingsSnapshot();
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([settingsToText(s)], {type: 'application/json'}));
  a.download = settingsFileName(); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  settingsSource = a.download; settingsMessage(settingsSummary(s, waitingSettings ? `Now open ${s.image && s.image.name || 'the image'}.` : 'Settings saved.'));
}
function loadSettingsFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const {settings} = parseSettings(reader.result), previousSource = settingsSource;
      settingsSource = file.name;
      const result = applySettings(settings);
      if (!result.ok) { settingsSource = previousSource; settingsMessage(`${file.name}: ${result.reason}`); }
    } catch (e) { settingsMessage(`${file.name}: ${e.message}`); }
  };
  reader.onerror = () => settingsMessage(`Could not read “${file.name}”. Try opening the settings file again.`);
  reader.readAsText(file);
}
function loadWorkspaceFile(file, pasted = false) {
  if (!file) return;
  if (/\.json$/i.test(file.name) || /^(application|text)\/(json|[^;]+\+json)(;|$)/i.test(file.type)) loadSettingsFile(file);
  else loadFile(file, pasted ? 'Pasted image' : file.name);
}

/** Middle ellipsis preserves the extension; insertion is always text, including names supplied by files. */
function imageNameText(name, max = 32) {
  if (name.length <= max) return name;
  const dot = name.lastIndexOf('.'), tail = dot > 0 ? Math.min(name.length - dot + 6, max - 8) : 12;
  return name.slice(0, max - tail - 1) + '…' + name.slice(-tail);
}
function updateImageName() {
  const el = $('#imgName'), name = S.img.el ? S.img.name || 'Unnamed image' : '';
  el.textContent = imageNameText(name); el.hidden = !name;
  el.title = name ? `${name} · ${S.img.w} × ${S.img.h} px` : '';
}
