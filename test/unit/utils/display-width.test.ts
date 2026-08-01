import { describe, expect, it } from 'vitest';

import { getColumnAt, getColumns } from '../../../src/utils/display-width.js';

describe('display width', () => {
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
});
