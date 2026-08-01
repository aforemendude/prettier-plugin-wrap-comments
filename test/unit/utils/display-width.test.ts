import { describe, expect, it } from 'vitest';

import { getColumnAt, getColumns } from '../../../src/utils/display-width.js';

describe('display width', () => {
  it('measures empty and plain ASCII text', () => {
    expect(getColumns('', 4)).toBe(0);
    expect(getColumns('plain text', 4)).toBe(10);
  });

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

  it('measures positions on the first line and after a CRLF newline', () => {
    const text = ['abc', '  def'].join('\r\n');

    expect(getColumnAt(text, 0, 4)).toBe(0);
    expect(getColumnAt(text, text.indexOf('def'), 4)).toBe(2);
  });
});
