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

  it('uses Prettier display widths for Unicode text', () => {
    expect(getColumns('\u6f22\u6f22\u6f22', 4)).toBe(6);
    expect(getColumns('\u{1f600}', 4)).toBe(2);
    expect(getColumns('e\u0301e\u0301e\u0301', 4)).toBe(3);
  });

  it('uses Unicode display widths when advancing to tab stops', () => {
    expect(getColumns('\u6f22\u6f22\tb', 4)).toBe(9);
    expect(getColumns('e\u0301e\u0301\tb', 4)).toBe(5);
    expect(getColumns('a\t\u6f22\u6f22\tb', 4)).toBe(13);
  });

  it('measures columns from the current line start', () => {
    const text = ['const value = 1;', '\t  // comment'].join('\n');
    const commentStart = text.indexOf('//');

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
    const crlfThenLfText = [['a', 'b'].join('\r\n'), ''].join('\n');
    const lfText = ['a', 'b', ''].join('\n');
    const crThenLfText = [['a', 'b'].join('\r'), ''].join('\n');

    expect(getPreferredNewline(crlfThenLfText, getWrapOptions({ endOfLine: 'lf' }))).toBe('\n');
    expect(getPreferredNewline(lfText, getWrapOptions({ endOfLine: 'crlf' }))).toBe('\r\n');
    expect(getPreferredNewline(lfText, getWrapOptions({ endOfLine: 'cr' }))).toBe('\r');
    expect(getPreferredNewline(crlfThenLfText, getWrapOptions({ endOfLine: 'auto' }))).toBe('\r\n');
    expect(getPreferredNewline(crThenLfText, getWrapOptions({ endOfLine: 'auto' }))).toBe('\r');
    expect(getPreferredNewline('single line', getWrapOptions({ endOfLine: 'auto' }))).toBe('\n');
  });
});
