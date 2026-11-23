'use strict';
/* parser.js — High-throughput chunked tabular parser (CSV / TSV / whitespace, RFC 4180 quotes),
 * auto-detection of delimiters, headers, column roles (Survey obs/obsm conventions),
 * and metadata parser (JSON + 2/3-column CSV/TSV/TXT).
 * Designed to parse 1,000,000+ rows directly into typed arrays with zero per-cell JS objects. */

const PARSER_CHUNK_BYTES = 4 * 1024 * 1024; // 4 MiB chunks for streaming File/Blob reads
const MISSING_TOKENS = new Set(['', 'na', 'nan', 'n/a', 'null', 'none', 'undefined', '.']);
const CELL_ID_NAMES = ['cell_id', 'cellid', 'cbc', 'cell_barcode', 'barcode', 'obs_names', 'obs_name', 'cell', 'unnamed: 0', 'index'];
const WELL_ID_NAMES = ['well_id', 'wellid', 'well', 'spot_id', 'spot', 'well_name'];
const CHIP_ID_NAMES = ['chip-num', 'chip_num', 'chipnum', 'chip_id', 'chip', 'array_id'];

function isMissingToken(s) {
  if (!s) return true;
  if (s.length <= 9) return MISSING_TOKENS.has(s.toLowerCase());
  return false;
}

function parseFiniteNumber(s) {
  if (!s) return NaN;
  const c0 = s.charCodeAt(0);
  // Fast reject obvious non-numbers (letters except Infinity/NaN)
  if (c0 > 57 && c0 !== 45 && c0 !== 43 && c0 !== 46) return NaN;
  const v = Number(s);
  return Number.isFinite(v) ? v : NaN;
}

/** Parse a single RFC 4180 record starting at pos in text; returns { fields, nextPos, incomplete }. */
function readCsvRecord(text, startPos, sepCode, isWhitespace, isLastChunk) {
  const len = text.length;
  let i = startPos;
  // Skip blank lines (\r, \n)
  while (i < len && (text.charCodeAt(i) === 10 || text.charCodeAt(i) === 13)) i++;
  if (i >= len) return null;

  if (isWhitespace) {
    let eol = i;
    while (eol < len && text.charCodeAt(eol) !== 10 && text.charCodeAt(eol) !== 13) eol++;
    if (eol >= len && !isLastChunk) return { incomplete: true, startPos: i };
    const line = text.slice(i, eol).trim();
    let next = eol;
    if (next < len && text.charCodeAt(next) === 13) next++;
    if (next < len && text.charCodeAt(next) === 10) next++;
    if (!line) return { fields: null, nextPos: next };
    const fields = [];
    let p = 0, n = line.length;
    while (p < n) {
      while (p < n && (line.charCodeAt(p) === 32 || line.charCodeAt(p) === 9)) p++;
      if (p >= n) break;
      if (line.charCodeAt(p) === 34) { // quoted token
        p++;
        let val = '';
        while (p < n) {
          const ch = line.charCodeAt(p);
          if (ch === 34) {
            if (p + 1 < n && line.charCodeAt(p + 1) === 34) { val += '"'; p += 2; }
            else { p++; break; }
          } else { val += line[p++]; }
        }
        fields.push(val);
      } else {
        const s0 = p;
        while (p < n && line.charCodeAt(p) !== 32 && line.charCodeAt(p) !== 9) p++;
        fields.push(line.slice(s0, p));
      }
    }
    return { fields, nextPos: next };
  }

  // Fast check: scan to next \n or \r and see if any quote (") exists on this line.
  let eol = i;
  let hasQuote = false;
  while (eol < len) {
    const ch = text.charCodeAt(eol);
    if (ch === 10 || ch === 13) break;
    if (ch === 34) { hasQuote = true; break; }
    eol++;
  }

  if (!hasQuote) {
    if (eol >= len && !isLastChunk) return { incomplete: true, startPos: i };
    const fields = [];
    let fStart = i;
    for (let k = i; k < eol; k++) {
      if (text.charCodeAt(k) === sepCode) {
        fields.push(text.slice(fStart, k));
        fStart = k + 1;
      }
    }
    fields.push(text.slice(fStart, eol));
    let next = eol;
    if (next < len && text.charCodeAt(next) === 13) next++;
    if (next < len && text.charCodeAt(next) === 10) next++;
    return { fields, nextPos: next };
  }

  // Full RFC 4180 quoted record parser (supports embedded delimiters, "" escapes, and embedded newlines).
  const fields = [];
  let p = i;
  let cur = '';
  let inQuotes = false;
  let fieldStart = true;

  while (p < len) {
    const ch = text.charCodeAt(p);
    if (inQuotes) {
      if (ch === 34) {
        if (p + 1 < len && text.charCodeAt(p + 1) === 34) {
          cur += '"';
          p += 2;
        } else if (p + 1 >= len && !isLastChunk) {
          return { incomplete: true, startPos: i };
        } else {
          inQuotes = false;
          p++;
        }
      } else {
        const s0 = p;
        while (p < len && text.charCodeAt(p) !== 34) p++;
        cur += text.slice(s0, p);
      }
    } else {
      if (fieldStart && ch === 34) {
        inQuotes = true;
        fieldStart = false;
        p++;
      } else if (ch === sepCode) {
        fields.push(cur);
        cur = '';
        fieldStart = true;
        p++;
      } else if (ch === 10 || ch === 13) {
        fields.push(cur);
        if (ch === 13 && p + 1 < len && text.charCodeAt(p + 1) === 10) p += 2;
        else p++;
        return { fields, nextPos: p };
      } else {
        fieldStart = false;
        const s0 = p;
        while (p < len) {
          const c2 = text.charCodeAt(p);
          if (c2 === sepCode || c2 === 10 || c2 === 13) break;
          p++;
        }
        cur += text.slice(s0, p);
      }
    }
  }

  if (!isLastChunk) return { incomplete: true, startPos: i };
  fields.push(cur);
  return { fields, nextPos: len };
}

/** Auto-detect delimiter (tab, comma, semicolon, or whitespace) from a text prefix. */
function detectDelimiter(sampleText) {
  const clean = sampleText.charCodeAt(0) === 0xfeff ? sampleText.slice(1) : sampleText;
  const candidates = [
    { delimiter: '\t', code: 9, isWhitespace: false, priority: 4 },
    { delimiter: ',', code: 44, isWhitespace: false, priority: 3 },
    { delimiter: ';', code: 59, isWhitespace: false, priority: 2 },
    { delimiter: ' ', code: 32, isWhitespace: true, priority: 1 },
  ];

  let best = null;
  for (const cand of candidates) {
    const counts = [];
    let pos = 0;
    while (counts.length < 24 && pos < clean.length) {
      const rec = readCsvRecord(clean, pos, cand.code, cand.isWhitespace, true);
      if (!rec) break;
      pos = rec.nextPos;
      if (rec.fields && rec.fields.length > 0) counts.push(rec.fields.length);
    }
    if (counts.length === 0) continue;
    const colCount = counts[0];
    if (colCount < 2) continue;
    let matches = 0;
    for (let i = 0; i < counts.length; i++) if (counts[i] === colCount) matches++;
    const consistency = matches / counts.length;
    const score = consistency * 100 + Math.min(colCount, 20) * 0.5 + cand.priority * 2;
    if (!best || score > best.score) {
      best = { ...cand, colCount, consistency, score };
    }
  }
  if (best) return { delimiter: best.delimiter, isWhitespace: best.isWhitespace };
  return { delimiter: ',', isWhitespace: false };
}

/** Detect whether the first record looks like a header row rather than data. */
function detectHasHeader(firstRow, sampleRows) {
  if (!firstRow || firstRow.length === 0) return true;

  const fields = firstRow.map(v => v.trim());
  const firstIsNumeric = fields.map(v => !Number.isNaN(parseFiniteNumber(v)));
  if (firstIsNumeric.every(Boolean)) return false;
  if (firstIsNumeric.filter(Boolean).length < 2) return true;
  // An explicit ID label can be followed by numeric column names (e.g. cell_id,0,1).
  const firstName = fields[0].toLowerCase();
  if (firstName === 'id' || CELL_ID_NAMES.includes(firstName)) return true;

  // In a headerless table the first field is the ID. Check whether remaining text
  // fields stand above consistently numeric values, which suggests column labels.
  for (let c = 1; c < fields.length; c++) {
    if (firstIsNumeric[c] || isMissingToken(fields[c])) continue;
    let nNum = 0, nNonEmpty = 0;
    for (let r = 0; r < sampleRows.length; r++) {
      const v = (sampleRows[r][c] || '').trim();
      if (!isMissingToken(v)) {
        nNonEmpty++;
        if (!Number.isNaN(parseFiniteNumber(v))) nNum++;
      }
    }
    if (nNonEmpty > 0 && nNum / nNonEmpty >= 0.85) return true;
  }
  return false;
}

/** Make column headers unique and clean. */
function normalizeHeaders(rawHeaders, colCount) {
  const out = [];
  const seen = new Map();
  for (let i = 0; i < colCount; i++) {
    let name = rawHeaders && rawHeaders[i] !== undefined ? String(rawHeaders[i]).trim() : '';
    if (!name) name = i === 0 ? 'cell_id' : `col_${i + 1}`;
    const count = seen.get(name) || 0;
    seen.set(name, count + 1);
    out.push(count === 0 ? name : `${name}_${count + 1}`);
  }
  return out;
}

/** Auto-detect cellId, x, y, wellId, row, col, centerX, centerY, chip, and color columns. */
function autoDetectColumns(columns, headers, rowCount) {
  const map = {
    cellId: -1, x: -1, y: -1,
    wellId: -1, row: -1, col: -1, centerX: -1, centerY: -1,
    chip: -1, color: -1,
  };
  const low = headers.map(h => h.trim().toLowerCase());

  const findExact = (names, predicate) => {
    for (const target of names) {
      for (let i = 0; i < low.length; i++) {
        if (low[i] === target && (!predicate || predicate(i))) return i;
      }
    }
    return -1;
  };
  const findSuffix = (suffixes, predicate) => {
    for (const suf of suffixes) {
      for (let i = 0; i < low.length; i++) {
        if ((low[i] === suf || low[i].endsWith(':' + suf) || low[i].endsWith('.' + suf)) && (!predicate || predicate(i))) return i;
      }
    }
    return -1;
  };
  const isNum = i => columns[i] && columns[i].kind === 'number';

  // 1. Cell ID
  map.cellId = findExact(CELL_ID_NAMES);
  // 2. X and Y (prefer cell-level coordinates over well center coordinates)
  map.x = findExact(
    ['x', 'x_survey_0', 'spatial_x', 'x_coord', 'xcoord', 'coord_x', 'pos_x', 'x_um', 'x_centroid', 'centroid_x', 'pxl_col_in_fullres', 'x1'],
    isNum
  );
  map.y = findExact(
    ['y', 'x_survey_1', 'spatial_y', 'y_coord', 'ycoord', 'coord_y', 'pos_y', 'y_um', 'y_centroid', 'centroid_y', 'pxl_row_in_fullres', 'x2'],
    isNum
  );

  // 3. Well center coordinates
  map.centerX = findExact(['arr-center_x', 'arr_center_x', 'center_x', 'well_center_x', 'well_x'], isNum);
  map.centerY = findExact(['arr-center_y', 'arr_center_y', 'center_y', 'well_center_y', 'well_y'], isNum);
  if (map.x === -1 && map.centerX !== -1) map.x = map.centerX;
  if (map.y === -1 && map.centerY !== -1) map.y = map.centerY;

  // 4. Well row & col (Survey uses arr-row, arr-col)
  map.row = findExact(['arr-row', 'arr_row', 'well_row', 'array_row', 'row', 'lyt-row', 'lyt_row'], isNum);
  map.col = findExact(['arr-col', 'arr_col', 'well_col', 'array_col', 'col', 'column', 'lyt-col', 'lyt_col'], isNum);

  // 5. Well ID (Survey uses 'id' in mdata['xyz'].obs!)
  map.wellId = findExact(WELL_ID_NAMES);
  const plainIdIdx = findExact(['id']);
  if (plainIdIdx !== -1) {
    if (map.cellId !== -1 && map.cellId !== plainIdIdx) {
      if (map.wellId === -1) map.wellId = plainIdIdx;
    } else {
      // With grid columns, numeric-looking or repeated IDs denote wells.
      const hasGrid = map.row !== -1 && map.col !== -1;
      const idCol = columns[plainIdIdx];
      const repeats = idCol.kind === 'category' && idCol.categories.length / rowCount < 0.85;
      const idValues = idCol.categories || idCol.strings;
      if (hasGrid && (repeats || idValues.every(v => !v || !Number.isNaN(parseFiniteNumber(v))))) {
        if (map.wellId === -1) map.wellId = plainIdIdx;
      } else if (map.cellId === -1) {
        map.cellId = plainIdIdx;
      }
    }
  }

  // Fallback Cell ID: first non-numeric/high-cardinality column not used as x/y/well
  if (map.cellId === -1) {
    for (let i = 0; i < columns.length; i++) {
      if (i === map.x || i === map.y || i === map.wellId || i === map.row || i === map.col) continue;
      if (columns[i].kind === 'string') { map.cellId = i; break; }
    }
  }

  // Fallback X/Y: first two numeric columns not already assigned
  if (map.x === -1 || map.y === -1) {
    const numCols = [];
    for (let i = 0; i < columns.length; i++) {
      if (isNum(i) && i !== map.cellId && i !== map.wellId && i !== map.row && i !== map.col) {
        numCols.push(i);
      }
    }
    if (map.x === -1 && numCols.length >= 1) map.x = numCols[0];
    if (map.y === -1 && numCols.length >= 2) map.y = numCols.find(i => i !== map.x) ?? -1;
  }

  // 6. Chip column (Survey uses chip-num, rna:chip-num, xyz:chip-num)
  map.chip = findSuffix(CHIP_ID_NAMES);

  // 7. Color covariate (default 'leiden' like segment.py, then cell types / clusters)
  const reserved = new Set([map.cellId, map.x, map.y, map.wellId, map.row, map.col, map.centerX, map.centerY, map.chip]);
  const nonReserved = i => !reserved.has(i) && columns[i].kind !== 'string';
  map.color = findSuffix(
    ['leiden', 'ct1', 'ct2', 'ct3', 'cell_type', 'celltype', 'cell-type', 'cluster', 'clusters', 'louvain', 'annotation', 'annot', 'subclass', 'class', 'type', 'group'],
    nonReserved
  );
  if (map.color === -1) {
    for (let i = 0; i < columns.length; i++) {
      if (nonReserved(i) && columns[i].kind === 'category') { map.color = i; break; }
    }
  }
  if (map.color === -1) {
    for (let i = 0; i < columns.length; i++) {
      if (nonReserved(i)) { map.color = i; break; }
    }
  }

  return map;
}

/* Dynamic typed column accumulator for fast 1M-row streaming parse. */
class ColumnBuilder {
  constructor(name, initialCap, initialKind) {
    this.name = name;
    this.kind = initialKind; // 'number' | 'category' | 'string'
    this.cap = Math.max(1024, initialCap);
    this.len = 0;
    this.missingCount = 0;
    this.num = initialKind === 'number' ? new Float32Array(this.cap) : null;
    this.codes = initialKind === 'category' ? new Uint16Array(this.cap) : null;
    this.wideCodes = false;
    this.catMap = initialKind === 'category' ? new Map() : null;
    this.categories = initialKind === 'category' ? [] : null;
    this.strings = initialKind === 'string' ? new Array(this.cap) : null;
  }

  _grow(minCap) {
    let nextCap = this.cap;
    while (nextCap < minCap) nextCap = nextCap < 262144 ? nextCap * 2 : Math.round(nextCap * 1.5);
    if (this.kind === 'number') {
      const next = new Float32Array(nextCap);
      next.set(this.num.subarray(0, this.len));
      this.num = next;
    } else if (this.kind === 'category') {
      const next = this.wideCodes ? new Uint32Array(nextCap) : new Uint16Array(nextCap);
      next.set(this.codes.subarray(0, this.len));
      this.codes = next;
    } else {
      this.strings.length = nextCap;
    }
    this.cap = nextCap;
  }

  _promoteNumToCategory() {
    const codes = new Uint16Array(this.cap);
    const map = new Map();
    const cats = [];
    for (let i = 0; i < this.len; i++) {
      const v = this.num[i];
      if (Number.isNaN(v)) {
        codes[i] = 0; // 0 reserved for missing
      } else {
        const s = String(v);
        let id = map.get(s);
        if (id === undefined) {
          id = cats.length + 1;
          cats.push(s);
          map.set(s, id);
          if (id >= 65534) {
            // Too many distinct values -> string column
            this._promotePartialToStrings(i, codes, cats, true);
            return;
          }
        }
        codes[i] = id;
      }
    }
    this.kind = 'category';
    this.num = null;
    this.codes = codes;
    this.catMap = map;
    this.categories = cats;
  }

  _promotePartialToStrings(doneCount, codes, cats, fromNum) {
    const arr = new Array(this.cap);
    for (let i = 0; i < doneCount; i++) {
      const c = codes[i];
      arr[i] = c === 0 ? '' : cats[c - 1];
    }
    if (fromNum) {
      for (let i = doneCount; i < this.len; i++) {
        const v = this.num[i];
        arr[i] = Number.isNaN(v) ? '' : String(v);
      }
    }
    this.kind = 'string';
    this.num = null;
    this.codes = null;
    this.catMap = null;
    this.categories = null;
    this.strings = arr;
  }

  _promoteCategoryToStrings() {
    const arr = new Array(this.cap);
    const codes = this.codes;
    const cats = this.categories;
    for (let i = 0; i < this.len; i++) {
      const c = codes[i];
      arr[i] = c === 0 ? '' : cats[c - 1];
    }
    this.kind = 'string';
    this.codes = null;
    this.catMap = null;
    this.categories = null;
    this.strings = arr;
  }

  push(raw) {
    if (this.len >= this.cap) this._grow(this.len + 1);
    const val = raw === undefined ? '' : raw;
    if (this.kind === 'number') {
      if (isMissingToken(val)) {
        this.num[this.len++] = NaN;
        this.missingCount++;
        return;
      }
      const n = parseFiniteNumber(val);
      if (!Number.isNaN(n)) {
        this.num[this.len++] = n;
        return;
      }
      // Non-numeric token found -> promote to category (or string if too many unique values)
      this._promoteNumToCategory();
      this.push(val);
      return;
    }
    if (this.kind === 'category') {
      if (isMissingToken(val)) {
        this.codes[this.len++] = 0;
        this.missingCount++;
        return;
      }
      let id = this.catMap.get(val);
      if (id === undefined) {
        if (this.categories.length >= 20000) {
          this._promoteCategoryToStrings();
          this.strings[this.len++] = val;
          return;
        }
        id = this.categories.length + 1;
        this.categories.push(val);
        this.catMap.set(val, id);
      }
      this.codes[this.len++] = id;
      return;
    }
    // string column
    if (!val) this.missingCount++;
    this.strings[this.len++] = val;
  }

  finalize() {
    const n = this.len;
    if (this.kind === 'number') {
      const num = this.num.subarray(0, n);
      let min = Infinity, max = -Infinity, valid = 0;
      for (let i = 0; i < n; i++) {
        const v = num[i];
        if (!Number.isNaN(v)) {
          if (v < min) min = v;
          if (v > max) max = v;
          valid++;
        }
      }
      if (valid === 0) { min = 0; max = 1; }
      // Sample up to 40,000 values for fast 1st & 99th percentile clipping
      let p01 = min, p99 = max;
      if (valid > 10) {
        const step = Math.max(1, Math.floor(n / 40000));
        const sample = [];
        for (let i = 0; i < n; i += step) {
          const v = num[i];
          if (!Number.isNaN(v)) sample.push(v);
        }
        sample.sort((a, b) => a - b);
        p01 = sample[Math.floor(sample.length * 0.01)];
        p99 = sample[Math.min(sample.length - 1, Math.floor(sample.length * 0.99))];
      }
      return {
        name: this.name, kind: 'number',
        num, codes: null, categories: null, counts: null, strings: null,
        min, max, p01, p99, missingCount: this.missingCount,
      };
    }
    if (this.kind === 'category') {
      const codes = this.codes.subarray(0, n);
      const counts = new Uint32Array(this.categories.length);
      for (let i = 0; i < n; i++) {
        const c = codes[i];
        if (c > 0) counts[c - 1]++;
      }
      return {
        name: this.name, kind: 'category',
        num: null, codes, categories: this.categories, counts, strings: null,
        min: 0, max: 0, p01: 0, p99: 0, missingCount: this.missingCount,
      };
    }
    this.strings.length = n;
    return {
      name: this.name, kind: 'string',
      num: null, codes: null, categories: null, counts: null, strings: this.strings,
      min: 0, max: 0, p01: 0, p99: 0, missingCount: this.missingCount,
    };
  }
}

/** Infer initial ColumnBuilder kinds from a sample of parsed rows. */
function inferInitialKinds(headers, sampleRows) {
  const numCols = headers.length;
  const kinds = new Array(numCols);
  for (let c = 0; c < numCols; c++) {
    const low = headers[c].toLowerCase();
    if (CELL_ID_NAMES.includes(low)) {
      kinds[c] = 'string';
      continue;
    }
    const suffix = low.slice(Math.max(low.lastIndexOf(':'), low.lastIndexOf('.')) + 1);
    if (low === 'id' || WELL_ID_NAMES.includes(low) || CHIP_ID_NAMES.includes(suffix)) {
      // Retain exact identifiers while reusing codes for repeated well and chip IDs.
      kinds[c] = 'category';
      continue;
    }
    let nonEmpty = 0, numeric = 0;
    const uniq = new Set();
    for (let r = 0; r < sampleRows.length; r++) {
      const v = (sampleRows[r][c] || '').trim();
      if (isMissingToken(v)) continue;
      nonEmpty++;
      if (!Number.isNaN(parseFiniteNumber(v))) numeric++;
      if (uniq.size < 2000) uniq.add(v);
    }
    if (nonEmpty > 0 && numeric === nonEmpty) {
      // Keep integer cluster codes and similar covariates categorical.
      if (/^(leiden|louvain|cluster|clusters|sample|batch)$/.test(low) && uniq.size <= 200) {
        kinds[c] = 'category';
      } else {
        kinds[c] = 'number';
      }
    } else if (sampleRows.length >= 20 && uniq.size >= nonEmpty * 0.95 && nonEmpty >= 50) {
      kinds[c] = 'string';
    } else {
      kinds[c] = 'category';
    }
  }
  return kinds;
}

/** Get string value for row r in a finalized column (fast helper for export & tooltips). */
function getColumnString(col, rowIdx) {
  if (!col) return '';
  if (col.kind === 'string') return col.strings[rowIdx] || '';
  if (col.kind === 'category') {
    const code = col.codes[rowIdx];
    return code > 0 ? col.categories[code - 1] : '';
  }
  const v = col.num[rowIdx];
  return Number.isNaN(v) ? '' : String(v);
}

function tableDelimiter(text, opts) {
  return opts.delimiter
    ? { delimiter: opts.delimiter, isWhitespace: Boolean(opts.isWhitespace) }
    : detectDelimiter(text.slice(0, 262144));
}

function tableHasHeader(records, opts) {
  return typeof opts.hasHeader === 'boolean'
    ? opts.hasHeader
    : detectHasHeader(records[0], records.slice(1, 50));
}

function createColumnBuilders(headers, sampleRows, capacity) {
  const kinds = inferInitialKinds(headers, sampleRows);
  return headers.map((name, index) => new ColumnBuilder(name, capacity, kinds[index]));
}

function finalizeTable(fileName, format, hasHeader, headers, builders, rowCount) {
  const columns = builders.map(builder => builder.finalize());
  return {
    fileName,
    delimiter: format.delimiter,
    isWhitespace: format.isWhitespace,
    hasHeader,
    headers,
    rowCount,
    columns,
    colMap: autoDetectColumns(columns, headers, rowCount),
  };
}

/**
 * Parse a File, Blob, or string asynchronously in chunks into typed arrays.
 * Options: { fileName, delimiter, isWhitespace, hasHeader (null=auto) }
 * Returns dataset object suitable for S.data.
 */
async function parseTableAsync(source, opts = {}, onProgress = null) {
  const isString = typeof source === 'string';
  const totalBytes = isString ? source.length : source.size;
  const fileName = opts.fileName || (!isString && source.name) || 'cells.csv';
  if (totalBytes === 0) throw new Error('The selected file is empty.');

  // Phase 1: Sniff first 256 KB
  const sniffLen = Math.min(totalBytes, 262144);
  const sniffText = isString
    ? source.slice(0, sniffLen).replace(/^\uFEFF/, '')
    : new TextDecoder().decode(await source.slice(0, sniffLen).arrayBuffer(), { stream: sniffLen < totalBytes });

  const format = tableDelimiter(sniffText, opts);
  const sepCode = format.delimiter.charCodeAt(0);
  const isWs = format.isWhitespace;

  const sampleRecs = [];
  let sPos = 0;
  while (sampleRecs.length < 200 && sPos < sniffText.length) {
    const rec = readCsvRecord(sniffText, sPos, sepCode, isWs, sniffLen >= totalBytes);
    if (!rec || rec.incomplete) break;
    sPos = rec.nextPos;
    if (rec.fields && rec.fields.length > 0) sampleRecs.push(rec.fields);
  }
  if (sampleRecs.length === 0) throw new Error('No rows could be read from this file.');

  const hasHeader = tableHasHeader(sampleRecs, opts);
  const firstDataRecs = hasHeader ? sampleRecs.slice(1) : sampleRecs;
  const colCount = sampleRecs[0].length;
  if (colCount < 2) throw new Error('Expected at least 2 columns (coordinates or cell data).');
  const headers = normalizeHeaders(hasHeader ? sampleRecs[0] : null, colCount);

  // Estimate row count from average line byte length to pre-size typed arrays (minimal reallocations!)
  const avgLineBytes = Math.max(8, sPos / Math.max(1, sampleRecs.length));
  const estRows = Math.min(2500000, Math.max(1024, Math.ceil((totalBytes / avgLineBytes) * 1.08)));
  const builders = createColumnBuilders(headers, firstDataRecs, estRows);

  // Phase 2: Stream-parse all chunks
  const decoder = isString ? null : new TextDecoder();
  let offset = 0;
  let leftover = '';
  let headerSkipped = !hasHeader;
  let rowCount = 0;
  let lastYield = performance.now();

  while (offset < totalBytes || leftover.length > 0) {
    let chunkStr = '';
    if (offset < totalBytes) {
      const end = Math.min(totalBytes, offset + PARSER_CHUNK_BYTES);
      if (isString) {
        chunkStr = source.slice(offset, end);
        if (offset === 0 && chunkStr.charCodeAt(0) === 0xfeff) chunkStr = chunkStr.slice(1);
      } else {
        chunkStr = decoder.decode(await source.slice(offset, end).arrayBuffer(), { stream: end < totalBytes });
      }
      offset = end;
    }
    const isLast = offset >= totalBytes;
    const text = leftover ? leftover + chunkStr : chunkStr;
    leftover = '';

    // Tight inner loop over records in this chunk
    let pos = 0;
    const len = text.length;
    while (pos < len) {
      // Ultra-fast unquoted non-whitespace path (handles 99%+ of bioinformatics tables)
      if (!isWs) {
        while (pos < len && (text.charCodeAt(pos) === 10 || text.charCodeAt(pos) === 13)) pos++;
        if (pos >= len) break;
        let eol = pos;
        let hasQuote = false;
        while (eol < len) {
          const ch = text.charCodeAt(eol);
          if (ch === 10 || ch === 13) break;
          if (ch === 34) { hasQuote = true; break; }
          eol++;
        }
        if (!hasQuote) {
          if (eol >= len && !isLast) {
            leftover = text.slice(pos);
            break;
          }
          if (!headerSkipped) {
            headerSkipped = true;
          } else {
            let fStart = pos;
            let colIdx = 0;
            for (let k = pos; k < eol; k++) {
              if (text.charCodeAt(k) === sepCode) {
                if (colIdx < colCount) builders[colIdx].push(text.slice(fStart, k));
                colIdx++;
                fStart = k + 1;
              }
            }
            if (colIdx < colCount) builders[colIdx].push(text.slice(fStart, eol));
            colIdx++;
            while (colIdx < colCount) builders[colIdx++].push('');
            rowCount++;
          }
          pos = eol;
          if (pos < len && text.charCodeAt(pos) === 13) pos++;
          if (pos < len && text.charCodeAt(pos) === 10) pos++;
          continue;
        }
      }

      // General path (whitespace-delimited or quoted RFC 4180 record)
      const rec = readCsvRecord(text, pos, sepCode, isWs, isLast);
      if (!rec) break;
      if (rec.incomplete) {
        leftover = text.slice(rec.startPos);
        break;
      }
      pos = rec.nextPos;
      if (!rec.fields) continue;
      if (!headerSkipped) {
        headerSkipped = true;
        continue;
      }
      const f = rec.fields;
      for (let c = 0; c < colCount; c++) {
        builders[c].push(c < f.length ? f[c] : '');
      }
      rowCount++;
    }

    if (onProgress) {
      const pct = totalBytes > 0 ? (offset / totalBytes) * 100 : 100;
      onProgress(pct, rowCount);
    }
    if (!isLast && performance.now() - lastYield > 24) {
      await new Promise(r => setTimeout(r, 0));
      lastYield = performance.now();
    }
    if (isLast && !leftover) break;
  }

  if (rowCount === 0) throw new Error('The file has a header row but no cell rows.');

  return finalizeTable(fileName, format, hasHeader, headers, builders, rowCount);
}

/** Synchronous parser for small strings & unit tests. */
function parseTableSync(text, opts = {}) {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  if (!clean.trim()) throw new Error('The selected file is empty.');
  const format = tableDelimiter(clean, opts);
  const sepCode = format.delimiter.charCodeAt(0);
  const isWs = format.isWhitespace;

  const records = [];
  let pos = 0;
  while (pos < clean.length) {
    const rec = readCsvRecord(clean, pos, sepCode, isWs, true);
    if (!rec) break;
    pos = rec.nextPos;
    if (rec.fields && rec.fields.length > 0) records.push(rec.fields);
  }
  if (records.length === 0) throw new Error('No rows could be read from this file.');
  const hasHeader = tableHasHeader(records, opts);
  const colCount = records[0].length;
  const headers = normalizeHeaders(hasHeader ? records[0] : null, colCount);
  const startRow = hasHeader ? 1 : 0;
  const dataRowCount = records.length - startRow;
  if (dataRowCount <= 0) throw new Error('The file has a header row but no cell rows.');

  const builders = createColumnBuilders(headers, records.slice(startRow, startRow + 100), Math.max(64, dataRowCount));
  for (let r = startRow; r < records.length; r++) {
    const f = records[r];
    for (let c = 0; c < colCount; c++) builders[c].push(c < f.length ? f[c] : '');
  }
  return finalizeTable(opts.fileName || 'data.csv', format, hasHeader, headers, builders, dataRowCount);
}

/**
 * Parse a metadata file:
 *  - JSON: supports Survey-style { colors: {col:{val:hex}}, meta: {col:{val:{color:hex}}},
 *    <col>_colors: [...], flat {val:hex}, array: {n,s,w,arr_shape,flat_top,origin,version},
 *    chips: {chipNum:{...}}, group, color_column, cell_size, y_invert, rois }
 *  - CSV/TSV/TXT: 2-column (value,color) or 3-column (covariate,value,color) with optional header.
 */
function parseMetadataText(text, fileName = 'metadata.json') {
  const trimmed = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).trim();
  if (!trimmed) throw new Error('Metadata file is empty.');

  const out = {
    fileName,
    colorsByCol: {},
    flatColors: {},
    array: null,
    chips: {},
    chipKeyProp: '',
    group: '',
    colorColumn: '',
    cellSize: null,
    yInvert: null,
    rois: null,
    colorCount: 0,
  };

  const addColColor = (colName, val, rawColor) => {
    const rgb = parseColorToRgb(rawColor);
    if (!rgb) return false;
    const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
    if (!out.colorsByCol[colName]) out.colorsByCol[colName] = {};
    out.colorsByCol[colName][String(val)] = hex;
    out.colorCount++;
    return true;
  };
  const addFlatColor = (val, rawColor) => {
    const rgb = parseColorToRgb(rawColor);
    if (!rgb) return false;
    out.flatColors[String(val)] = rgbToHex(rgb[0], rgb[1], rgb[2]);
    out.colorCount++;
    return true;
  };

  // Try JSON first if it starts with '{' or '[' or filename ends with .json
  if (trimmed[0] === '{' || trimmed[0] === '[' || /\.json$/i.test(fileName)) {
    let obj;
    try { obj = JSON.parse(trimmed); } catch (err) {
      throw new Error('Could not parse metadata JSON: ' + err.message);
    }
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
      throw new Error('Metadata JSON must be an object.');
    }

    const reservedKeys = new Set([
      'colors', 'meta', 'array', 'array_params', 'chips', 'chip_meta',
      'chip_key_prop', 'group', 'color_column', 'color', 'cell_size', 'size',
      'y_invert', 'rois', 'version', 'kind', 'description',
    ]);

    // 1. Explicit colors: { colName: { val: color } }
    if (obj.colors && typeof obj.colors === 'object' && !Array.isArray(obj.colors)) {
      for (const [k, v] of Object.entries(obj.colors)) {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          for (const [val, col] of Object.entries(v)) addColColor(k, val, col);
        } else {
          addFlatColor(k, v);
        }
      }
    }

    // 2. Survey uns['meta'] style: { meta: { colName: { catVal: { color: '#...' } | '#...' } } }
    if (obj.meta && typeof obj.meta === 'object') {
      for (const [colName, catMap] of Object.entries(obj.meta)) {
        if (!catMap || typeof catMap !== 'object') continue;
        for (const [catVal, props] of Object.entries(catMap)) {
          if (props && typeof props === 'object' && !Array.isArray(props) && props.color != null) {
            addColColor(colName, catVal, props.color);
          } else {
            addColColor(colName, catVal, props);
          }
        }
      }
    }

    // 3. Scanpy-style <col>_colors array or top-level flat { value: color } / nested { col: { value: color } }
    for (const [k, v] of Object.entries(obj)) {
      if (reservedKeys.has(k)) continue;
      if (k.endsWith('_colors') && Array.isArray(v)) {
        const colName = k.slice(0, -7);
        v.forEach((c, idx) => addColColor(colName, String(idx), c));
      } else if (typeof v === 'string' || Array.isArray(v)) {
        addFlatColor(k, v);
      } else if (v && typeof v === 'object') {
        for (const [val, col] of Object.entries(v)) {
          if (col && typeof col === 'object' && !Array.isArray(col) && col.color != null) {
            addColColor(k, val, col.color);
          } else {
            addColColor(k, val, col);
          }
        }
      }
    }

    // 4. Display & Survey Chip/Array metadata
    if (obj.array && typeof obj.array === 'object') out.array = normalizeArrayMeta(obj.array);
    if (obj.chips && typeof obj.chips === 'object') {
      for (const [chipKey, chipDef] of Object.entries(obj.chips)) {
        if (chipDef && typeof chipDef === 'object') {
          const merged = (obj.array_params && chipDef.version && obj.array_params[chipDef.version])
            ? { ...obj.array_params[chipDef.version], ...chipDef }
            : chipDef;
          const norm = normalizeArrayMeta(merged);
          if (norm) out.chips[String(chipKey)] = norm;
        }
      }
    }
    if (typeof obj.chip_key_prop === 'string') out.chipKeyProp = obj.chip_key_prop;
    if (typeof obj.group === 'string' && obj.group.trim()) out.group = obj.group.trim();
    if (typeof obj.color_column === 'string' && obj.color_column.trim()) out.colorColumn = obj.color_column.trim();
    else if (typeof obj.color === 'string' && obj.color.trim() && !parseColorToRgb(obj.color)) out.colorColumn = obj.color.trim();
    if (Number.isFinite(Number(obj.cell_size))) out.cellSize = clamp(Number(obj.cell_size), 1, 20);
    else if (Number.isFinite(Number(obj.size))) out.cellSize = clamp(Number(obj.size), 1, 20);
    if (typeof obj.y_invert === 'boolean') out.yInvert = obj.y_invert;
    if (Array.isArray(obj.rois)) {
      out.rois = obj.rois
        .filter(r => r && typeof r.name === 'string' && r.name.trim())
        .map(r => ({ name: r.name.trim(), color: normalizeHexColor(r.color, '#58d8f5') }));
    }
    return out;
  }

  // Otherwise parse 2-column (value,color) or 3-column (covariate,value,color) CSV/TSV/TXT
  const det = detectDelimiter(trimmed);
  const sepCode = det.delimiter.charCodeAt(0);
  const rows = [];
  let pos = 0;
  while (pos < trimmed.length) {
    const rec = readCsvRecord(trimmed, pos, sepCode, det.isWhitespace, true);
    if (!rec) break;
    pos = rec.nextPos;
    if (rec.fields && rec.fields.length >= 2) rows.push(rec.fields.map(s => s.trim()));
  }
  if (rows.length === 0) throw new Error('No value,color pairs found in metadata file.');

  const first = rows[0];
  let start = 0;
  let targetCol = '';
  const joinColorTail = (row, fromIdx) => row.length > fromIdx + 1 && /^rgba?\(/i.test(row[fromIdx])
    ? row.slice(fromIdx).join(',')
    : row[fromIdx];
  const isThreeCol = first.length >= 3 && !/^rgba?\(/i.test(first[1]) && !parseColorToRgb(first[1]);
  if (isThreeCol) {
    if (!parseColorToRgb(joinColorTail(first, 2))) start = 1; // header row like covariate,value,color
    for (let i = start; i < rows.length; i++) {
      if (rows[i].length >= 3) addColColor(rows[i][0], rows[i][1], joinColorTail(rows[i], 2));
    }
  } else {
    if (!parseColorToRgb(joinColorTail(first, 1))) {
      start = 1; // header row like value,color OR leiden,color
      const h0 = first[0].toLowerCase();
      if (!['value', 'category', 'label', 'name', 'key', 'class', 'group'].includes(h0) && first[0]) {
        targetCol = first[0];
      }
    }
    for (let i = start; i < rows.length; i++) {
      if (rows[i].length >= 2) {
        const colStr = joinColorTail(rows[i], 1);
        if (targetCol) addColColor(targetCol, rows[i][0], colStr);
        else addFlatColor(rows[i][0], colStr);
      }
    }
  }
  if (out.colorCount === 0) throw new Error('No valid color entries found in metadata file.');
  return out;
}

function normalizeArrayMeta(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const shape = Array.isArray(raw.arr_shape) && raw.arr_shape.length === 2
    ? [Math.round(Number(raw.arr_shape[0])), Math.round(Number(raw.arr_shape[1]))]
    : (Number(raw.n_rows) > 0 && Number(raw.n_cols) > 0
      ? [Math.round(Number(raw.n_rows)), Math.round(Number(raw.n_cols))]
      : null);
  const s = Number(raw.s ?? raw.well_size ?? raw.well ?? 0);
  const w = Number(raw.w ?? raw.wall_width ?? raw.wall ?? 0);
  const pitch = Number(raw.pitch || (s + w) || 0);
  if (!shape || shape[0] <= 0 || shape[1] <= 0) return null;
  const n = Number(raw.n) === 6 || String(raw.shape || raw.well_shape || '').toLowerCase().startsWith('hex') ? 6 : 4;
  return {
    version: raw.version != null ? String(raw.version) : '',
    n,
    s: s > 0 ? s : (pitch > 0 ? pitch * 0.85 : 170),
    w: w >= 0 && (s > 0 || w > 0) ? w : (pitch > 0 ? pitch * 0.15 : 30),
    arr_shape: shape,
    flat_top: raw.flat_top !== false,
    origin: raw.origin === 'center' ? 'center' : 'corner',
  };
}
