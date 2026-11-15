'use strict';
/* chiplist.js — WHICH chip versions exist: the live list CHIPS and everything that fills it. (What a chip means for the
 * canvas scale is presets.js; the panel that shows the list is buildChipPanel / renderChipList in panels.js.)
 *
 * SOURCES, in order of priority at start-up (initChipList, called at the bottom of this file):
 *   1. a list the user loaded earlier with "Load chip list…", remembered in localStorage (key CHIP_STORAGE_KEY);
 *   2. the packaged, user-editable file ../chips.js (BUILTIN_CHIPS). A mistake in that file is caught by the small inline
 *      script in index.html (CHIPS_FILE_ERROR) and shown in the panel instead of breaking the app.
 * CHIPS is ONE array for the whole session: its contents are replaced in place (setChipList), it is never reassigned.
 * PURE HELPERS (no app state, easy to test): toNum, validateChips, parseDelimitedRows, mapCsvHeader, parseChipFile.
 *   validateChips(list) → {chips, errors}: normalised chips + plain-language reasons for every skipped one.
 *   parseChipFile(text, name) → raw list from JSON or a CSV exported from the lab spreadsheet (its own column names).
 * index.html?nostore switches the remembered list off (tests.html uses it, so tests never read or delete a real list).
 * All lengths are µm. To add a field: validateChips (normalise it) → mapCsvHeader (its column names) → updateChipInfo (show it). */

const CHIP_STORAGE_KEY = 'gridStudio.chipList';
const BUILTIN_SOURCE_LABEL = 'built-in file chips.js';
const MAX_CHIP_WELLS = 400000;               // same limit as MAX_CELLS in grid.js: more wells than this cannot be drawn
const CHIP_STORE_OFF = /[?&]nostore\b/.test(location.search);   // index.html?nostore: never read or write the remembered chip list (used by tests.html)
const CHIPS = [];
let chipListSource = BUILTIN_SOURCE_LABEL;
let chipListMessages = [];

const toNum = v => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  if (typeof v === 'string') {
    let t = v.trim(); if (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?(\s*\D*)$/.test(t)) t = t.replace(/,(?=\d{3})/g, '');   // "19,500" = 19500
    const s = t.replace(/^([+-]?\d+(?:\.\d+)?)\s*(?:µm|μm|um|°|deg|%)?$/i, '$1');
    if (!s) return NaN;
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
};

/** Pure validator: normalises valid chip entries and reports plain-language reasons for any skipped ones. */
function validateChips(list) {
  if (!Array.isArray(list)) return {chips: [], errors: ['The chip list must be an array of chip versions.']};
  const chips = [], errors = [], seen = new Set();
  list.forEach((raw, idx) => {
    const rowLabel = `Row ${idx + 1}`;
    if (!raw || typeof raw !== 'object') { errors.push(`${rowLabel}: not a valid chip entry.`); return; }
    const id = typeof raw.id === 'string' || typeof raw.id === 'number' ? String(raw.id).replace(/\s+/g, ' ').trim() : '';   // (line breaks in a name would not survive the panel)
    if (!id) { errors.push(`${rowLabel}: missing chip version name (id).`); return; }
    const name = `Chip "${id}"`;
    if (seen.has(id)) { errors.push(`${name}: duplicate chip version name (already listed earlier).`); return; }

    let shape = raw.shape === undefined || raw.shape === null || String(raw.shape).trim() === '' ? 'square' : String(raw.shape).trim().toLowerCase();
    if (shape === 'round' || shape === 'circular') shape = 'circle';
    if (shape !== 'square' && shape !== 'circle') {
      errors.push(`${name}: shape "${raw.shape}" must be "square" or "circle".`);
      return;
    }

    const pitch = toNum(raw.pitch);
    if (!(pitch > 0)) { errors.push(`${name}: nominal pitch must be a number greater than 0 µm.`); return; }
    const well = toNum(raw.well);
    if (!(well > 0)) { errors.push(`${name}: well size must be a number greater than 0 µm.`); return; }
    if (well >= pitch) { errors.push(`${name}: the well (${well} µm) must be smaller than the pitch (${pitch} µm), so that there is a wall between wells.`); return; }

    const expectedWall = +(pitch - well).toFixed(6);
    let wall = expectedWall;
    if (raw.wall !== undefined && raw.wall !== null && String(raw.wall).trim() !== '') {
      const wNum = toNum(raw.wall);
      if (!Number.isFinite(wNum) || wNum < 0) { errors.push(`${name}: wall width must be a non-negative number.`); return; }
      if (Math.abs(wNum - expectedWall) > 0.5) {
        errors.push(`${name}: wall (${wNum} µm) does not match pitch − well (${expectedWall} µm).`);
        return;
      }
      wall = wNum;
    }

    const wide = toNum(raw.wide), long = toNum(raw.long);
    if (!Number.isInteger(wide) || wide < 1) { errors.push(`${name}: wells wide must be a positive whole number.`); return; }
    if (!Number.isInteger(long) || long < 1) { errors.push(`${name}: wells long must be a positive whole number.`); return; }

    if (wide * long > MAX_CHIP_WELLS) { errors.push(`${name}: ${wide} × ${long} wells is more than the app can draw (${MAX_CHIP_WELLS.toLocaleString('en-US')} wells at most).`); return; }

    const hasVal = v => v !== undefined && v !== null && String(v).trim() !== '' && String(v).trim().toLowerCase() !== 'null' && String(v).trim().toLowerCase() !== 'n/a';
    const depthNum = hasVal(raw.depth) ? toNum(raw.depth) : null;
    const depth = Number.isFinite(depthNum) ? depthNum : null;
    const bottom = raw.bottom !== undefined && raw.bottom !== null ? String(raw.bottom).trim() : '';
    const draftNum = hasVal(raw.draft) ? toNum(raw.draft) : null;
    const draft = Number.isFinite(draftNum) ? draftNum : null;
    const wUm = hasVal(raw.widthUm) ? toNum(raw.widthUm) : NaN;
    const lUm = hasVal(raw.lengthUm) ? toNum(raw.lengthUm) : NaN;
    const widthUm = wUm > 0 ? wUm : wide * pitch;
    const lengthUm = lUm > 0 ? lUm : long * pitch;

    seen.add(id);
    chips.push({id, shape, bottom, draft, pitch, well, wall, depth, widthUm, lengthUm, wide, long});
  });
  return {chips, errors};
}

/** Parse a single delimited row (CSV/TSV/semicolon), respecting quoted fields and "" escapes. */
function parseDelimitedRows(text, delim) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(field); field = '';
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(c => c.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some(c => c.trim() !== '')) rows.push(row);
  return rows;
}

function mapCsvHeader(rawHeader) {
  const h = String(rawHeader ?? '').trim().toLowerCase();
  if (!h) return null;
  if (/\bcm\b/.test(h) || /centimet/.test(h)) return null;   // ignore array width/length in cm
  const norm = h.replace(/[\(\)\[\]]/g, ' ').replace(/[µμ]m|\bum\b|\bmicrons?\b|\bmicromet(?:er|re)s?\b/g, ' ').replace(/[^a-z0-9#]+/g, ' ').trim();
  const compact = norm.replace(/\s+/g, '');
  if (compact === 'id' || compact === 'chipversion' || compact === 'version' || compact === 'chip' || compact === 'chipid' || compact === 'name') return 'id';
  if (compact === 'shape' || compact === 'wellshape') return 'shape';
  if (compact === 'bottom' || compact === 'wellbottom' || compact === 'bottomshape') return 'bottom';
  if (compact === 'draft' || compact === 'draftangle') return 'draft';
  if (compact === 'pitch' || compact === 'nominalpitch' || compact === 'wellpitch') return 'pitch';
  if (compact === 'well' || compact === 'wellsize' || compact === 'wellwidth' || compact === 'wellopening' || compact === 'opening') return 'well';
  if (compact === 'wall' || compact === 'topwallwidth' || compact === 'wallwidth' || compact === 'wallsize' || compact === 'topwall') return 'wall';
  if (compact === 'depth' || compact === 'welldepth') return 'depth';
  if (compact === 'wide' || compact === '#wellswide' || compact === 'wellswide' || compact === 'numwellswide' || compact === 'numberofwellswide' || compact === 'cols' || compact === 'columns') return 'wide';
  if (compact === 'long' || compact === '#wellslong' || compact === 'wellslong' || compact === 'numwellslong' || compact === 'numberofwellslong' || compact === 'rows') return 'long';
  if (compact === 'widthum' || compact === 'arraywidth') return 'widthUm';
  if (compact === 'lengthum' || compact === 'arraylength') return 'lengthUm';
  return null;
}

/** Pure parser for .json or .csv/.txt chip files. Returns a raw array for setChipList, or throws a plain-language Error. */
function parseChipFile(text, fileName = '') {
  const clean = String(text ?? '').replace(/^\uFEFF/, '').trim();
  if (!clean) throw new Error('The selected file is empty.');
  const isJsonExt = /\.json$/i.test(fileName);
  if (isJsonExt || clean.startsWith('[') || clean.startsWith('{')) {
    let parsed;
    try { parsed = JSON.parse(clean); }
    catch (e) { throw new Error(`Could not read JSON file${fileName ? ` "${fileName}"` : ''}: ${e.message}`); }
    const arr = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.chips) ? parsed.chips : null);
    if (!arr) throw new Error('JSON chip file must contain an array of chips or an object with a "chips" array.');
    return arr;
  }

  const firstLine = clean.split(/\r?\n/)[0] || '';
  const counts = [',', ';', '\t'].map(d => ({d, n: parseDelimitedRows(firstLine, d)[0]?.length || 0})).sort((a, b) => b.n - a.n);
  const delim = counts[0].n > 1 ? counts[0].d : ',';
  const rows = parseDelimitedRows(clean, delim);
  if (!rows.length) throw new Error('The CSV file has no rows.');

  const cols = rows[0].map(mapCsvHeader);
  const required = [['id', 'Chip Version'], ['pitch', 'Nominal Pitch'], ['well', 'Well size'], ['wide', '# wells wide'], ['long', '# wells long']];
  const missing = required.filter(([k]) => !cols.includes(k)).map(([, label]) => label);
  if (missing.length) {
    throw new Error(`Could not find required column(s): ${missing.join(', ')}. Expected headers like "Chip Version", "Nominal Pitch", "Well size", "# wells wide", "# wells long".`);
  }

  const out = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.every(c => c.trim() === '')) continue;
    const obj = {};
    cols.forEach((key, cIdx) => {
      if (!key || obj[key] !== undefined) return;
      let val = (row[cIdx] ?? '').trim();
      if (delim !== ',' && /^[+-]?\d+,\d+(\s*(µm|μm|um|%|°))?$/.test(val)) val = val.replace(',', '.');   // decimal comma ("52,5") in ;- or tab-separated sheets
      if (val !== '') obj[key] = val;
    });
    if (Object.keys(obj).length) out.push(obj);
  }
  return out;
}

/** Validate and replace CHIPS in place, update UI + active chip geometry, and return {count, errors}. */
function setChipList(list, sourceLabel = chipListSource) {
  const {chips, errors} = validateChips(list);
  if (!chips.length) {
    const msg = errors.length ? errors : ['No valid chip versions were found in the list.'];
    chipListMessages = msg;
    if (typeof renderChipList === 'function') renderChipList();
    return {count: 0, errors: msg};
  }
  const u = umPerPx();                                               // the microscope does not change when the chip table does
  CHIPS.splice(0, CHIPS.length, ...chips);
  if (typeof afUndoState !== 'undefined') afUndoState = null;        // an old auto-fit undo may name a chip that is gone now
  chipListSource = sourceLabel || BUILTIN_SOURCE_LABEL;
  chipListMessages = errors;
  if (typeof renderChipList === 'function') renderChipList();
  if (S.chip.id) {
    const stillExists = CHIPS.some(c => c.id === S.chip.id);
    selectChip(stillExists ? S.chip.id : null);
    if (u && pxPerUm()) { S.img.scale = u * pxPerUm(); refresh('gl', 'status'); }   // same µm per image pixel as before, even if this chip's numbers changed
  } else if (typeof frame === 'function') {
    refresh('gl', 'grid', 'layout', 'crop', 'status');
  }
  return {count: CHIPS.length, errors};
}

const builtinFingerprint = () => typeof BUILTIN_CHIPS !== 'undefined' && Array.isArray(BUILTIN_CHIPS) ? JSON.stringify(BUILTIN_CHIPS) : '';
/** Remember a loaded list for next time. Returns false when the browser would not store it (private window, storage full or blocked). */
function saveChipListToStorage(source, chips) {
  if (CHIP_STORE_OFF) return false;
  try { localStorage.setItem(CHIP_STORAGE_KEY, JSON.stringify({source, chips, builtin: builtinFingerprint()})); return true; } catch (_) { return false; }
}
function clearStoredChipList() {
  if (CHIP_STORE_OFF) return;
  try { localStorage.removeItem(CHIP_STORAGE_KEY); } catch (_) {}
}
function readStoredChipList() {
  if (CHIP_STORE_OFF) return null;
  try {
    const raw = localStorage.getItem(CHIP_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.chips)) return null;
    return data;
  } catch (_) { return null; }
}
function isUsingBuiltinChips() {
  return chipListSource === BUILTIN_SOURCE_LABEL;
}

/** Load the built-in chips.js list (used at start-up and by "Use built-in list"). */
function useBuiltinChipList() {
  clearStoredChipList();
  if (typeof BUILTIN_CHIPS === 'undefined' || !Array.isArray(BUILTIN_CHIPS)) {
    CHIPS.splice(0, CHIPS.length);
    chipListSource = `${BUILTIN_SOURCE_LABEL} (missing or syntax error)`;
    const why = typeof CHIPS_FILE_ERROR === 'string' && CHIPS_FILE_ERROR ? `there is a mistake at ${CHIPS_FILE_ERROR}` : 'the file is missing or has a mistake in it';
    chipListMessages = [`Could not read chips.js: ${why}. Fix chips.js and reload the page, or click "Load chip list…" to pick a file.`];
    if (typeof renderChipList === 'function') renderChipList();
    if (S.chip.id) selectChip(null);
    else if (typeof frame === 'function') refresh('gl', 'grid', 'layout', 'crop', 'status');
    return {count: 0, errors: chipListMessages};
  }
  return setChipList(BUILTIN_CHIPS, BUILTIN_SOURCE_LABEL);
}

/** Initialise CHIPS at script load: prefer valid stored list, otherwise built-in chips.js. */
function initChipList() {
  const stored = readStoredChipList();
  if (stored) {
    const {chips} = validateChips(stored.chips);
    if (chips.length) {
      const src = stored.source ? (/^loaded from /i.test(stored.source) ? stored.source : `loaded from ${stored.source}`) : 'loaded from saved list';
      setChipList(stored.chips, src);
      if (typeof stored.builtin === 'string' && stored.builtin !== builtinFingerprint()) {   // the remembered list wins, so say when chips.js has moved on
        chipListMessages.push('Note: chips.js has been changed since this list was loaded, but the loaded list is still in use. Click "Use built-in list" to switch to chips.js.');
        if (typeof renderChipList === 'function') renderChipList();
      }
      return;
    }
  }
  useBuiltinChipList();
}

initChipList();                              // presets.js is already loaded: setChipList() needs its umPerPx() / selectChip()
