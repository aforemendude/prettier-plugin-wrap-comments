import { describe, expect, it } from 'vitest';

import {
  applyReplacements,
  getColumnAt,
  getColumns,
  getPreferredNewline,
  makeIndent,
} from '../../../src/shared/text.js';
import { getWrapOptions } from '../support/options.js';

describe('column measurement', () => {
  it('measures tabs with the configured tab width', () => {
    expect(getColumns('  \tword', 2)).toBe(8);
    expect(getColumns('  \tword', 4)).toBe(8);
    expect(getColumns('  \tword', 8)).toBe(12);
    expect(getColumns('a\tb', 4)).toBe(5);
    expect(getColumns('a\tb', 8)).toBe(9);
  });

  it('measures columns from the current line start', () => {
    const text = 'const value = 1;\n\t  // comment',
      commentStart = text.indexOf('//');

    expect(getColumnAt(text, commentStart, 2)).toBe(4);
    expect(getColumnAt(text, commentStart, 4)).toBe(6);
    expect(getColumnAt(text, commentStart, 8)).toBe(10);
  });

  it('creates indentation with spaces or tabs', () => {
    expect(makeIndent(6, getWrapOptions({ tabWidth: 4 }))).toBe('      ');
    expect(makeIndent(6, getWrapOptions({ tabWidth: 4, useTabs: true }))).toBe('\t  ');
    expect(makeIndent(6, getWrapOptions({ useTabs: true }))).toBe('\t\t\t');
    expect(makeIndent(10, getWrapOptions({ tabWidth: 8, useTabs: true }))).toBe('\t  ');
  });
});

describe('applyReplacements', () => {
  it('applies adjacent and out-of-order replacements', () => {
    expect(
      applyReplacements('abcdef', [
        { end: 5, start: 4, text: 'E' },
        { end: 2, start: 1, text: 'B' },
        { end: 3, start: 2, text: 'C' },
      ]),
    ).toBe('aBCdEf');
  });

  it('keeps the wider replacement when replacements overlap', () => {
    expect(
      applyReplacements('abcdef', [
        { end: 4, start: 2, text: 'Y' },
        { end: 5, start: 1, text: 'X' },
      ]),
    ).toBe('aXf');
  });

  it('drops contained overlapping replacements after an earlier accepted range', () => {
    expect(
      applyReplacements('abcdef', [
        { end: 4, start: 1, text: 'X' },
        { end: 3, start: 2, text: 'Y' },
        { end: 6, start: 5, text: 'F' },
      ]),
    ).toBe('aXeF');
  });

  it('applies multiple insertions at the same offset', () => {
    expect(
      applyReplacements('ac', [
        { end: 1, start: 1, text: 'b' },
        { end: 1, start: 1, text: 'B' },
      ]),
    ).toBe('aBbc');
  });
});

describe('getPreferredNewline', () => {
  it('selects the configured or detected newline sequence', () => {
    expect(getPreferredNewline('a\r\nb\n', getWrapOptions({ endOfLine: 'lf' }))).toBe('\n');
    expect(getPreferredNewline('a\nb\n', getWrapOptions({ endOfLine: 'crlf' }))).toBe('\r\n');
    expect(getPreferredNewline('a\nb\n', getWrapOptions({ endOfLine: 'cr' }))).toBe('\r');
    expect(getPreferredNewline('a\r\nb\n', getWrapOptions({ endOfLine: 'auto' }))).toBe('\r\n');
    expect(getPreferredNewline('a\rb\n', getWrapOptions({ endOfLine: 'auto' }))).toBe('\r');
    expect(getPreferredNewline('single line', getWrapOptions({ endOfLine: 'auto' }))).toBe('\n');
  });
});
