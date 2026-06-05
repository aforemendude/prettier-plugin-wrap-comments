import assert from 'node:assert/strict';
import test from 'node:test';
import { getColumnAt, getColumns, makeIndent } from '../dist/shared/text.js';

test('measures tabs with the configured tab width', () => {
  assert.equal(getColumns('  \tword', 2), 8);
  assert.equal(getColumns('  \tword', 4), 8);
  assert.equal(getColumns('  \tword', 8), 12);
  assert.equal(getColumns('a\tb', 4), 5);
  assert.equal(getColumns('a\tb', 8), 9);
});

test('measures columns from the current line start', () => {
  const text = 'const value = 1;\n\t  // comment';
  const commentStart = text.indexOf('//');

  assert.equal(getColumnAt(text, commentStart, 2), 4);
  assert.equal(getColumnAt(text, commentStart, 4), 6);
  assert.equal(getColumnAt(text, commentStart, 8), 10);
});

test('creates indentation with spaces or tabs', () => {
  assert.equal(makeIndent(6, { tabWidth: 4, useTabs: false }), '      ');
  assert.equal(makeIndent(6, { tabWidth: 4, useTabs: true }), '\t  ');
  assert.equal(makeIndent(6, { tabWidth: 2, useTabs: true }), '\t\t\t');
  assert.equal(makeIndent(10, { tabWidth: 8, useTabs: true }), '\t  ');
});
