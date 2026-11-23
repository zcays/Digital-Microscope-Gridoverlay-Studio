'use strict';
/* state.js — Global state S, Scanpy palettes, continuous colormaps, color parsing,
 * DOM cache, dirty-layer scheduler, and toast notifications for SUGAR Segment.
 * Never replace top-level sub-objects of S (mutate in place where listeners hold references). */

const PALETTE_20 = [
  '#1f77b4', '#ff7f0e', '#279e68', '#d62728', '#aa40fc',
  '#8c564b', '#e377c2', '#b5bd61', '#17becf', '#aec7e8',
  '#ffbb78', '#98df8a', '#ff9896', '#c5b0d5', '#c49c94',
  '#f7b6d2', '#dbdb8d', '#9edae5', '#ad494a', '#8c6d31',
];

const PALETTE_28 = [
  '#023fa5', '#7d87b9', '#bec1d4', '#d6bcc0', '#bb7784', '#8e063b', '#4a6fe3',
  '#8595e1', '#b5bbe3', '#e6afb9', '#e07b91', '#d33f6a', '#11c638', '#8dd593',
  '#c6dec7', '#ead3c6', '#f0b98d', '#ef9708', '#0fcfc0', '#9cded6', '#d5eae7',
  '#f3e1eb', '#f6c4e1', '#f79cd4', '#7f7f7f', '#c7c7c7', '#1ce6ff', '#336600',
];

const PALETTE_102 = [
  '#ffff00', '#1ce6ff', '#ff34ff', '#ff4a46', '#008941', '#006fa6', '#a30059', '#ffdbe5', '#7a4900', '#0000a6',
  '#63ffac', '#b79762', '#004d43', '#8fb0ff', '#997d87', '#5a0007', '#809693', '#6a3a4c', '#1b4400', '#4fc601',
  '#3b5dff', '#4a3b53', '#ff2f80', '#61615a', '#ba0900', '#6b7900', '#00c2a0', '#ffaa92', '#ff90c9', '#b903aa',
  '#d16100', '#ddefff', '#000035', '#7b4f4b', '#a1c299', '#300018', '#0aa6d8', '#013349', '#00846f', '#372101',
  '#ffb500', '#c2ffed', '#a079bf', '#cc0744', '#c0b9b2', '#c2ff99', '#001e09', '#00489c', '#6f0062', '#0cbd66',
  '#eec3ff', '#456d75', '#b77b68', '#7a87a1', '#788d66', '#885578', '#fad09f', '#ff8a9a', '#d157a0', '#bec459',
  '#456648', '#0086ed', '#886f4c', '#34362d', '#b4a8bd', '#00a6aa', '#452c2c', '#636375', '#a3c8c9', '#ff913f',
  '#938a81', '#575329', '#00fecf', '#b05b6f', '#8cd0ff', '#3b9700', '#04f757', '#c8a1a1', '#1e6e00', '#7900d7',
  '#a77500', '#6367a9', '#a05837', '#6b002c', '#772600', '#d790ff', '#9b9700', '#549e79', '#fff69f', '#201625',
  '#72418f', '#bc23ff', '#99adc0', '#3a2465', '#922329', '#5b4534', '#fde8dc', '#404e55', '#0089a3', '#cb7e98',
  '#a4e804', '#324e72',
];

const NAMED_COLORS = {
  black: '#000000', k: '#000000', white: '#ffffff', w: '#ffffff',
  red: '#e53935', r: '#e53935', green: '#2e7d32', g: '#2e7d32',
  blue: '#1e88e5', b: '#1e88e5', cyan: '#00acc1', c: '#00acc1',
  magenta: '#d81b60', m: '#d81b60', yellow: '#fdd835', y: '#fdd835',
  orange: '#fb8c00', purple: '#8e24aa', pink: '#ec407a', brown: '#6d4c41',
  gray: '#757575', grey: '#757575', lightgray: '#bdbdbd', darkgray: '#424242',
  teal: '#00897b', lime: '#7cb342', navy: '#1a237e', olive: '#827717',
  coral: '#ff7043', gold: '#ffb300', indigo: '#3949ab', violet: '#ab47bc',
  salmon: '#ef9a9a', turquoise: '#26c6da', skyblue: '#4fc3f7', crimson: '#c62828',
  'tab:blue': '#1f77b4', 'tab:orange': '#ff7f0e', 'tab:green': '#2ca02c',
  'tab:red': '#d62728', 'tab:purple': '#9467bd', 'tab:brown': '#8c564b',
  'tab:pink': '#e377c2', 'tab:gray': '#7f7f7f', 'tab:olive': '#bcbd22', 'tab:cyan': '#17becf',
};

/* Control stops for built-in continuous colormaps (interpolated into 256-entry RGB LUTs). */
const COLORMAP_STOPS = {
  viridis: [
    [68, 1, 84], [72, 40, 120], [62, 74, 137], [49, 104, 142], [38, 130, 142],
    [31, 158, 137], [53, 183, 121], [109, 205, 89], [180, 222, 44], [253, 231, 37],
  ],
  plasma: [
    [13, 8, 135], [75, 3, 161], [125, 3, 168], [168, 34, 150], [203, 70, 121],
    [229, 107, 93], [248, 148, 65], [253, 195, 40], [240, 249, 33],
  ],
  inferno: [
    [0, 0, 4], [27, 12, 65], [74, 12, 107], [120, 28, 109], [165, 44, 96],
    [207, 68, 70], [237, 105, 37], [251, 155, 6], [247, 209, 61], [252, 255, 164],
  ],
  magma: [
    [0, 0, 4], [24, 15, 61], [69, 16, 119], [114, 31, 129], [159, 47, 127],
    [205, 64, 113], [241, 96, 93], [253, 149, 103], [254, 201, 141], [252, 253, 191],
  ],
  cividis: [
    [0, 32, 77], [0, 51, 111], [57, 72, 107], [94, 98, 110], [125, 124, 120],
    [159, 151, 119], [195, 179, 105], [234, 210, 86], [253, 234, 69],
  ],
  coolwarm: [
    [59, 76, 192], [98, 130, 234], [141, 176, 254], [184, 208, 249], [221, 221, 221],
    [245, 196, 173], [244, 154, 123], [222, 96, 77], [180, 4, 38],
  ],
};

const COLORMAP_LUTS = {};
(function buildColormapLuts() {
  for (const name of Object.keys(COLORMAP_STOPS)) {
    const stops = COLORMAP_STOPS[name];
    const lut = new Uint8Array(256 * 3);
    const segs = stops.length - 1;
    for (let i = 0; i < 256; i++) {
      const t = (i / 255) * segs;
      const idx = Math.min(segs - 1, Math.floor(t));
      const f = t - idx;
      const a = stops[idx], b = stops[idx + 1];
      lut[i * 3] = Math.round(a[0] + (b[0] - a[0]) * f);
      lut[i * 3 + 1] = Math.round(a[1] + (b[1] - a[1]) * f);
      lut[i * 3 + 2] = Math.round(a[2] + (b[2] - a[2]) * f);
    }
    COLORMAP_LUTS[name] = lut;
  }
})();

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function rgbToHex(r, g, b) {
  const h = v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return '#' + h(r) + h(g) + h(b);
}

/** Parse hex (#RGB, #RRGGBB, #RRGGBBAA), rgb/rgba(), [r,g,b] (0..1 or 0..255), or named colors. Returns [r,g,b] or null. */
function parseColorToRgb(input) {
  if (input == null) return null;
  if (Array.isArray(input) && input.length >= 3) {
    const nums = [Number(input[0]), Number(input[1]), Number(input[2])];
    if (nums.some(n => !Number.isFinite(n))) return null;
    const scale = nums.every(n => n >= 0 && n <= 1) ? 255 : 1;
    return [clamp(Math.round(nums[0] * scale), 0, 255), clamp(Math.round(nums[1] * scale), 0, 255), clamp(Math.round(nums[2] * scale), 0, 255)];
  }
  let s = String(input).trim();
  if (!s) return null;
  const low = s.toLowerCase();
  if (NAMED_COLORS[low]) s = NAMED_COLORS[low];
  if (s[0] === '#') {
    const hex = s.slice(1);
    if (/^[0-9a-f]{3}$/i.test(hex)) {
      return [parseInt(hex[0] + hex[0], 16), parseInt(hex[1] + hex[1], 16), parseInt(hex[2] + hex[2], 16)];
    }
    if (/^[0-9a-f]{6}$/i.test(hex) || /^[0-9a-f]{8}$/i.test(hex)) {
      return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
    }
    return null;
  }
  const m = /^rgba?\(\s*([0-9.]+%?)\s*[,\s]\s*([0-9.]+%?)\s*[,\s]\s*([0-9.]+%?)(?:\s*[,/]\s*[0-9.]+%?)?\s*\)$/i.exec(s);
  if (m) {
    const ch = [m[1], m[2], m[3]].map(v => v.endsWith('%') ? parseFloat(v) * 2.55 : parseFloat(v));
    if (ch.every(Number.isFinite)) return ch.map(v => clamp(Math.round(v), 0, 255));
  }
  return null;
}

function normalizeHexColor(input, fallback = '#58d8f5') {
  const rgb = parseColorToRgb(input);
  return rgb ? rgbToHex(rgb[0], rgb[1], rgb[2]) : fallback;
}

/** Palette matching survey/singlecell/scutils.py get_color_mapper. */
function getDefaultPalette(count) {
  if (count <= 20) return PALETTE_20;
  if (count <= 28) return PALETTE_28;
  return PALETTE_102;
}

function paletteColor(index, totalCount) {
  const pal = getDefaultPalette(totalCount || 20);
  return pal[index % pal.length];
}

const $ = (sel, root = document) => root.querySelector(sel);

const DEFAULT_SEGMENT_GROUP = 'tissue';
const DEFAULT_CELL_SIZE = 3;
const DEFAULT_DERIVED_GRID = { mode: 'auto', targetBins: 50, pitch: 0 };

function emptySegmentMetadata() {
  return {
    fileName: '',
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
}

/* Global mutable application state (mutate sub-objects in place). */
const S = {
  data: {
    fileName: '',
    delimiter: '\t',
    isWhitespace: false,
    hasHeader: true,
    headers: [],
    rowCount: 0,
    columns: [],
    colMap: {
      cellId: -1, x: -1, y: -1,
      wellId: -1, row: -1, col: -1, centerX: -1, centerY: -1,
      chip: -1, color: -1,
    },
  },
  meta: emptySegmentMetadata(),
  chips: {
    list: [],
    active: '',
    cellIndicesByChip: new Map(), // chipName -> Int32Array of row indices in S.data
  },
  chipStates: new Map(), // chipName -> ChipSegState
  group: DEFAULT_SEGMENT_GROUP,
  tool: 'fill',          // 'fill' | 'erase' | 'flood_fill' | 'flood_erase' | 'pan'
  brushSize: 1,          // 1, 3, 5, 7, ... (wells x wells)
  autoResetFlood: true,  // Matches segment.py 'Auto-reset Flood' default True
  derivedGrid: { ...DEFAULT_DERIVED_GRID },
  display: {
    cellSize: DEFAULT_CELL_SIZE,
    cellAlpha: 0.9,
    roiAlpha: 0.5,       // Matches segment.py alpha 0.5
    showBorders: true,
    showCells: true,
    showRois: true,
    colormap: 'viridis',
    clipPercentile: true,
    logScale: false,
    yInvert: false,      // false = math Y-up (matching matplotlib / Survey Array), true = screen Y-down
    bgImage: null,       // HTMLImageElement or null
    bgName: '',
    bgAlpha: 0.5,
  },
  view: {
    cx: 0, cy: 0, scale: 1,
    cssW: 800, cssH: 600, dpr: 1,
  },
  hover: {
    wellIdx: -1,
    cellIdx: -1,
    dataX: 0,
    dataY: 0,
    inside: false,
  },
  renderer: 'webgl',     // 'webgl' | 'cpu'
  cellColors: {
    chip: '',
    colIdx: -1,
    colormap: '',
    clip: true,
    log: false,
    metaRev: 0,
    rgba: null,          // Uint8Array(chipCellCount * 4)
    legend: null,        // { kind: 'category'|'number'|'none', items?, min?, max?, colName? }
  },
  metaRev: 0,
  busy: false,
};

const dom = {};
const dirtyFlags = {
  cells: false,
  cellColors: false,
  overlay: false,
  cursor: false,
  bg: false,
  ui: false,
  rois: false,
  legend: false,
  status: false,
};
let rafId = 0;

function activeChipState() {
  return S.chips.active ? (S.chipStates.get(S.chips.active) || null) : null;
}

function activeChipCells() {
  return S.chips.active ? (S.chips.cellIndicesByChip.get(S.chips.active) || null) : null;
}

function dirty(...layers) {
  for (let i = 0; i < layers.length; i++) dirtyFlags[layers[i]] = true;
  if (!rafId && typeof requestAnimationFrame === 'function') {
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      if (typeof flushFrame === 'function') flushFrame();
    });
  }
}

function refresh(...layers) {
  dirty(...layers);
  if (typeof flushFrame === 'function') {
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    flushFrame();
  }
}

let toastTimer = 0;
function toast(msg, ms = 3200) {
  if (!dom.toast) return;
  dom.toast.textContent = String(msg);
  dom.toast.style.display = 'block';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { dom.toast.style.display = 'none'; }, ms);
}

function setProgress(visible, label = '', pct = 0) {
  if (!dom.progressWrap) return;
  dom.progressWrap.hidden = !visible;
  if (visible) {
    if (dom.progressLabel) dom.progressLabel.textContent = label;
    if (dom.progressBar) dom.progressBar.style.width = clamp(pct, 0, 100).toFixed(1) + '%';
  }
}
