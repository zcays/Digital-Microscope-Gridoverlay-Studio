'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const parserPath = path.join(__dirname, '../segment/js/parser.js');
const parser = vm.createContext({ TextDecoder, performance, setTimeout });
// Set SUGAR_TEST_ASAR to exercise the parser shipped in a desktop build.
const archive = process.env.SUGAR_TEST_ASAR;
const parserSource = archive
  ? require('@electron/asar').extractFile(archive, 'segment/js/parser.js').toString('utf8')
  : fs.readFileSync(parserPath, 'utf8');
vm.runInContext(parserSource, parser, { filename: parserPath });
const { parseTableSync, parseTableAsync, getColumnString } = parser;

async function parseBoth(text) {
  return [parseTableSync(text), await parseTableAsync(new Blob([text]))];
}

function values(dataset, role) {
  const col = dataset.columns[dataset.colMap[role]];
  assert.ok(col, `Expected a column for ${role}`);
  return Array.from({ length: dataset.rowCount }, (_, i) => getColumnString(col, i));
}

test('cell, well, and namespaced chip IDs retain leading zeros and distinct large integers', async () => {
  const ids = ['0016777216', '0016777217'];
  const rows = ids.map((id, i) => `${id},${i + 1},${i + 2},${id},${id}`);
  const text = ['index,x,y,well_id,xyz:chip-num', ...rows].join('\n');
  for (const dataset of await parseBoth(text)) {
    assert.deepEqual(values(dataset, 'cellId'), ids);
    assert.deepEqual(values(dataset, 'wellId'), ids);
    assert.deepEqual(values(dataset, 'chip'), ids);
    assert.equal(dataset.columns[dataset.colMap.x].num[0], 1);
    assert.equal(dataset.columns[dataset.colMap.y].num[1], 3);
  }
});

test('plain id preserves text and keeps its Survey well role when grid columns exist', async () => {
  const ids = ['0016777216', '0016777217'];
  for (const dataset of await parseBoth('id,x,y\n0016777216,1,2\n0016777217,3,4')) {
    assert.deepEqual(values(dataset, 'cellId'), ids);
  }
  const grid = 'id,x,y,arr-row,arr-col\n0016777216,1,2,0,0\n0016777217,3,4,0,1';
  for (const dataset of await parseBoth(grid)) {
    assert.equal(dataset.colMap.cellId, -1);
    assert.deepEqual(values(dataset, 'wellId'), ids);
  }
});

test('headerless cellA rows are preserved, including single-row and numeric-ID files', async () => {
  for (const [text, ids] of [
    ['cellA,1,2\ncellB,3,4', ['cellA', 'cellB']],
    ['cellA,1,2', ['cellA']],
    ['0016777216,1,2\n0016777217,3,4', ['0016777216', '0016777217']],
  ]) {
    for (const dataset of await parseBoth(text)) {
      assert.equal(dataset.hasHeader, false);
      assert.deepEqual(values(dataset, 'cellId'), ids);
      assert.equal(dataset.columns[dataset.colMap.x].num[0], 1);
      assert.equal(dataset.columns[dataset.colMap.y].num[0], 2);
    }
  }
});

test('recognized ID headers can appear with numeric coordinate labels', async () => {
  for (const dataset of await parseBoth('cell_id,0,1\ncellA,10,20\ncellB,30,40')) {
    assert.equal(dataset.hasHeader, true);
    assert.deepEqual(values(dataset, 'cellId'), ['cellA', 'cellB']);
    assert.equal(dataset.columns[dataset.colMap.x].num[0], 10);
  }
});

test('a Blob keeps a four-byte UTF-8 character split across 4 MiB chunks', async () => {
  const chunkBytes = 4 * 1024 * 1024;
  const prefix = '\uFEFFcell_id,x,y\r\nbase,1,2\r\n';
  const padding = '\n'.repeat(chunkBytes - Buffer.byteLength(prefix) - 3);
  // The quote and two bytes of the emoji land in the first chunk.
  const blob = new Blob([prefix, padding, '"🧬,célula",3,4\r\nlast,5,6']);
  const dataset = await parseTableAsync(blob);
  assert.deepEqual(values(dataset, 'cellId'), ['base', '🧬,célula', 'last']);
  assert.deepEqual(values(dataset, 'x'), ['1', '3', '5']);
});
