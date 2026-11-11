'use strict';
/* Right-hand settings panels. Each control reads from / writes to state through get/set callbacks. */

/* Arrow-key increment per setting when it is focused (plain press).
 * Shift = ×10, Alt/Option = ×0.1; never finer than the slider's own step. */
const KEY_STEP = {
  'Square size': 1, 'Spacing (both)': 1, 'Spacing ↔ horiz.': 1, 'Spacing ↕ vert.': 1,
  'Dead space (all)': 5, 'Space left': 5, 'Space right': 5, 'Space top': 5, 'Space bottom': 5,
  'Offset X': 1, 'Offset Y': 1, 'Columns (0=auto)': 1, 'Rows (0=auto)': 1, 'Corner radius': 1, 'Line width': .5, 'Opacity %': 5,
  'Grid zoom %': 5, 'Image µm/px': .05, 'Strength': .01, 'Edge falloff': .01, 'Centre X %': 1, 'Centre Y %': 1,
  'Position X': 1, 'Position Y': 1, 'Scale %': 1, 'Rotate °': .5, 'Width px': 10, 'Height px': 10,
};
const ARROW_DIR = {ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1};
const decimalsOf = n => n < 1 ? Math.ceil(-Math.log10(n)) : 0;

/** Label + slider + number box, with custom arrow-key stepping. */
function slider(parent, label, get, set, min, max, step) {
  const keyStep = KEY_STEP[label] || Math.max(step, (max - min) / 100), decimals = Math.max(decimalsOf(step), decimalsOf(keyStep));
  const row = document.createElement('div'); row.className = 'row';
  row.innerHTML = `<label>${label}</label><input type="range" min="${min}" max="${max}" step="${step}"><input type="number" step="${keyStep}">`;
  const range = row.children[1], num = row.children[2];

  const show = () => {                                  // don't overwrite the control the user is typing in
    const v = get();
    if (document.activeElement !== range) range.value = v;
    if (document.activeElement !== num) num.value = (+v).toFixed(decimals);
  };
  const commit = v => { set(v); syncAll(); };
  range.oninput = () => commit(+range.value);
  num.oninput = () => { if (num.value !== '' && !isNaN(+num.value)) commit(+num.value); };

  const bump = (dir, e) => {
    const k = Math.max(step, keyStep * (e.shiftKey ? 10 : 1) * (e.altKey ? .1 : 1));
    commit(+(get() + dir * k).toFixed(4)); range.value = get(); num.value = (+get()).toFixed(decimals);
  };
  const onArrow = allowed => e => {
    const dir = ARROW_DIR[e.key];
    if (!dir || !allowed.includes(e.key) || e.metaKey || e.ctrlKey) return;
    e.preventDefault(); e.stopPropagation(); bump(dir, e);
  };
  range.addEventListener('keydown', onArrow(Object.keys(ARROW_DIR)));
  num.addEventListener('keydown', onArrow(['ArrowUp', 'ArrowDown']));      // left/right still move the text caret

  parent.append(row); syncs.push(show); show();
}

function line(parent, label, html) {
  const d = document.createElement('div'); d.className = 'line'; d.innerHTML = `<label>${label}</label>${html}`;
  parent.append(d); return d;
}
function note(parent, text, id) { const n = document.createElement('div'); n.className = 'note'; n.textContent = text; if (id) n.id = id; parent.append(n); }
function checkbox(parent, label, get, set, hint = '') {
  const cb = line(parent, label, `<input type="checkbox">${hint ? `<span class="note">${hint}</span>` : ''}`).querySelector('input');
  cb.onchange = () => set(cb.checked); syncs.push(() => cb.checked = get()); cb.checked = get();
}
function buttons(parent, spec) {
  const d = line(parent, '', spec.map(([id, text, cls]) => `<button id="${id}" ${cls ? `class="${cls}"` : ''}>${text}</button>`).join(''));
  spec.forEach(([id,, , fn]) => d.querySelector('#' + id).onclick = fn); return d;
}

function buildGridPanel() {
  const p = $('#p-grid'), G = S.grid, touch = (...fn) => v => { fn.forEach(f => f(v)); dirty('grid'); };
  let lastSpacing = G.gapX, lastMargin = G.mL;
  const allEqual = (...v) => v.every(x => x === v[0]);

  checkbox(p, 'Show grid', () => G.visible, v => { G.visible = v; dirty('grid'); });
  line(p, 'Style', '<select id="gMode"><option value="outline">Outlined squares</option><option value="filled">Filled squares</option></select>');
  $('#gMode').onchange = e => { G.mode = e.target.value; dirty('grid'); };

  // Manual sizing: switched off (greyed) while a chip version is ticked, because the chip dictates shape, size and spacing.
  const m = document.createElement('div'); m.id = 'gridManual'; p.append(m);
  line(m, 'Shape', '<select id="gShape"><option value="square">Squares</option><option value="circle">Circles</option></select>');
  $('#gShape').onchange = e => { G.shape = e.target.value; dirty('grid'); };
  slider(m, 'Square size', () => G.size, touch(v => G.size = Math.max(1, v)), 2, 200, 1);
  slider(m, 'Spacing (both)', () => allEqual(G.gapX, G.gapY) ? G.gapX : lastSpacing, touch(v => G.gapX = G.gapY = lastSpacing = Math.max(0, v)), 0, 200, 1);
  slider(m, 'Spacing ↔ horiz.', () => G.gapX, touch(v => G.gapX = Math.max(0, v)), 0, 200, 1);
  slider(m, 'Spacing ↕ vert.', () => G.gapY, touch(v => G.gapY = Math.max(0, v)), 0, 200, 1);
  slider(m, 'Dead space (all)', () => allEqual(G.mL, G.mR, G.mT, G.mB) ? G.mL : lastMargin, touch(v => G.mL = G.mR = G.mT = G.mB = lastMargin = Math.max(0, v)), 0, 400, 1);
  for (const [label, key] of [['Space left', 'mL'], ['Space right', 'mR'], ['Space top', 'mT'], ['Space bottom', 'mB']])
    slider(m, label, () => G[key], touch(v => G[key] = Math.max(0, v)), 0, 400, 1);
  checkbox(m, 'Centre array', () => G.center, v => { G.center = v; dirty('grid'); }, 'spread leftover room evenly on both ends');
  slider(m, 'Columns (0=auto)', () => G.cols, touch(v => G.cols = Math.max(0, Math.round(v))), 0, 100, 1);
  slider(m, 'Rows (0=auto)', () => G.rows, touch(v => G.rows = Math.max(0, Math.round(v))), 0, 100, 1);
  syncs.push(() => $('#gShape').value = G.shape);

  slider(p, 'Offset X', () => G.offX, touch(v => G.offX = v), -2000, 2000, 1);
  slider(p, 'Offset Y', () => G.offY, touch(v => G.offY = v), -2000, 2000, 1);
  slider(p, 'Corner radius', () => G.radius, touch(v => G.radius = Math.max(0, v)), 0, 50, 1);
  slider(p, 'Line width', () => G.stroke, touch(v => G.stroke = Math.max(.25, v)), .5, 10, .25);
  slider(p, 'Opacity %', () => G.opacity * 100, touch(v => G.opacity = clamp(v, 0, 100) / 100), 0, 100, 1);

  const swatches = ['#ffffff', '#000000', '#ff3b30', '#34c759', '#00e5ff', '#ffd60a', '#ff2dff'];
  const colour = line(p, 'Colour', '<input type="color" id="gCol">' + swatches.map(c => `<button class="sw" data-c="${c}" style="background:${c}"></button>`).join(''));
  $('#gCol').oninput = e => { G.color = e.target.value; dirty('grid'); };
  syncs.push(() => $('#gCol').value = G.color);
  colour.querySelectorAll('.sw').forEach(b => b.onclick = () => { G.color = b.dataset.c; refresh('grid'); });
  note(p, 'The grid is fixed to the canvas — it stays put while you move, rotate or correct the image underneath.');
}

function buildLensPanel() {
  const p = $('#p-lens'), L = S.lens, touch = fn => v => { fn(v); dirty('gl'); };
  slider(p, 'Strength', () => L.k1, touch(v => L.k1 = v), -1, 1.5, .005);
  slider(p, 'Edge falloff', () => L.k2, touch(v => L.k2 = v), -1, 1, .005);
  slider(p, 'Centre X %', () => L.cx * 100, touch(v => L.cx = v / 100), 0, 100, .5);
  slider(p, 'Centre Y %', () => L.cy * 100, touch(v => L.cy = v / 100), 0, 100, .5);
  checkbox(p, 'Before / after', () => L.bypass, v => { L.bypass = v; dirty('gl'); }, 'show original');
  buttons(p, [['lReset', 'Reset lens', '', resetLens]]);
  note(p, 'Positive Strength straightens barrel (fisheye) bowing; negative fixes pincushion. Use the grid as a straight-line reference. Edge falloff fine-tunes the outer corners.');
}

function buildImagePanel() {
  const p = $('#p-img'), I = S.img, touch = fn => v => { fn(v); dirty('gl', 'status'); };
  slider(p, 'Position X', () => I.x, touch(v => I.x = v), -2000, 4000, 1);
  slider(p, 'Position Y', () => I.y, touch(v => I.y = v), -2000, 4000, 1);
  slider(p, 'Scale %', () => I.scale * 100, touch(v => I.scale = Math.max(1, v) / 100), 10, 400, .5);
  slider(p, 'Rotate °', () => I.rot, touch(v => I.rot = v), -180, 180, .1);
  buttons(p, [['iCenter', 'Centre', '', centerImage], ['iFit', 'Fit to canvas', '', fitImageToCanvas], ['iReset', 'Reset', '', resetImageTransform]]);
  note(p, 'Arrow keys nudge the image 1 px (Shift = 10 px). Or drag with the Move tool.');
}

const ASPECTS = [['Free', 0], ['Same as canvas', -1], ['1 : 1', 1], ['4 : 3', 4 / 3], ['3 : 2', 1.5], ['16 : 9', 16 / 9], ['3 : 4', .75], ['2 : 3', 2 / 3], ['9 : 16', 9 / 16]];
function buildCropPanel() {
  const p = $('#p-crop');
  line(p, 'Aspect', `<select id="cRatio">${ASPECTS.map(([t, v]) => `<option value="${v}">${t}</option>`).join('')}</select>`);
  $('#cRatio').onchange = e => { S.ratio = +e.target.value; const r = ratioValue(); if (S.crop && r) { fitRatio(r); dirty('crop'); } };
  buttons(p, [['cStart', 'Crop tool', '', () => setTool('crop')], ['cropApply', 'Apply crop', 'primary', applyCrop], ['cCancel', 'Cancel', '', cancelCrop]]);
  note(p, '', 'cropInfo');
  note(p, 'Drag to draw, drag handles to resize, Enter to apply, Esc to cancel, ⌘/Ctrl+Z to undo.');
}

function buildDocPanel() {
  const p = $('#p-doc'), touch = fn => v => { fn(v); dirty('layout', 'gl', 'status'); };
  slider(p, 'Width px', () => S.doc.w, touch(v => S.doc.w = clamp(Math.round(v), 16, MAX_DOC)), 100, 4000, 1);
  slider(p, 'Height px', () => S.doc.h, touch(v => S.doc.h = clamp(Math.round(v), 16, MAX_DOC)), 100, 4000, 1);
}

function buildChipPanel() {
  const p = $('#p-chip');
  const list = document.createElement('div'); list.className = 'chips';
  list.innerHTML = CHIPS.map(c => `<label class="chip"><input type="checkbox" data-id="${c.id}"><span><b>${c.id}</b><small>${c.shape} · pitch ${c.pitch} / well ${c.well} µm</small></span></label>`).join('');
  p.append(list);
  list.querySelectorAll('input').forEach(cb => cb.onchange = () => selectChip(cb.checked ? cb.dataset.id : null));   // ticking one unticks the others

  const tools = document.createElement('div'); p.append(tools);
  slider(tools, 'Grid zoom %', () => S.chip.zoom, v => setChipZoom(v), 10, 1000, 1);
  slider(tools, 'Image µm/px', () => umPerPx() || 0, setImageUmPerPx, 0.1, 40, .01);
  checkbox(tools, 'Real array only', () => S.chip.arrayOnly, v => { S.chip.arrayOnly = v; dirty('grid'); }, 'just the N × M wells, centred');
  const info = document.createElement('div'); info.id = 'chipInfo'; info.className = 'info'; p.append(info);
  note(p, 'Tick a version: the grid takes its shape, well size and pitch from the table, true to scale, and fills the whole canvas. Then move / scale / rotate the image until it lines up with the wells — the µm/px readout is your image\'s calibration. Untick for the manual grid.');

  syncs.push(() => {
    list.querySelectorAll('.chip').forEach(l => { const cb = l.querySelector('input'), on = cb.dataset.id === S.chip.id; cb.checked = on; l.classList.toggle('on', on); });
    tools.classList.toggle('off', !S.chip.id); tools.inert = !S.chip.id;
    const manual = $('#gridManual'); manual.classList.toggle('off', !!S.chip.id); manual.inert = !!S.chip.id;
    updateChipInfo();
  });
}

function buildPanels() {
  buildGridPanel(); buildChipPanel(); buildLensPanel(); buildImagePanel(); buildCropPanel(); buildDocPanel();
  syncAll();
}
