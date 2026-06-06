import assert from 'node:assert/strict';
import test from 'node:test';
import { applyReplacements, getColumnAt, getColumns, getPreferredNewline, makeIndent } from '../dist/shared/text.js';

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

test('applies adjacent and out-of-order replacements', () => {
  assert.equal(
    applyReplacements('abcdef', [
      { end: 5, start: 4, text: 'E' },
      { end: 2, start: 1, text: 'B' },
      { end: 3, start: 2, text: 'C' },
    ]),
    'aBCdEf',
  );
});

test('keeps the wider replacement when replacements overlap', () => {
  assert.equal(
    applyReplacements('abcdef', [
      { end: 4, start: 2, text: 'Y' },
      { end: 5, start: 1, text: 'X' },
    ]),
    'aXf',
  );
});

test('drops contained overlapping replacements after an earlier accepted range', () => {
  assert.equal(
    applyReplacements('abcdef', [
      { end: 4, start: 1, text: 'X' },
      { end: 3, start: 2, text: 'Y' },
      { end: 6, start: 5, text: 'F' },
    ]),
    'aXeF',
  );
});

test('applies multiple insertions at the same offset', () => {
  assert.equal(
    applyReplacements('ac', [
      { end: 1, start: 1, text: 'b' },
      { end: 1, start: 1, text: 'B' },
    ]),
    'aBbc',
  );
});

test('selects the configured or detected newline sequence', () => {
  assert.equal(getPreferredNewline('a\r\nb\n', { endOfLine: 'lf' }), '\n');
  assert.equal(getPreferredNewline('a\nb\n', { endOfLine: 'crlf' }), '\r\n');
  assert.equal(getPreferredNewline('a\nb\n', { endOfLine: 'cr' }), '\r');
  assert.equal(getPreferredNewline('a\r\nb\n', { endOfLine: 'auto' }), '\r\n');
  assert.equal(getPreferredNewline('a\rb\n', { endOfLine: 'auto' }), '\r');
  assert.equal(getPreferredNewline('single line', { endOfLine: 'auto' }), '\n');
});
