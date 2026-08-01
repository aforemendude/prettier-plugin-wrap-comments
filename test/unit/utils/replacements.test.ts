import { describe, expect, it } from 'vitest';

import { applyReplacements } from '../../../src/utils/replacements.js';

describe('applyReplacements', () => {
  it('returns the original text when there are no replacements', () => {
    expect(applyReplacements('abcdef', [])).toBe('abcdef');
  });

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

  it('applies deletions and full-range replacements', () => {
    expect(applyReplacements('abcdef', [{ end: 5, start: 1, text: '' }])).toBe('af');
    expect(applyReplacements('abcdef', [{ end: 6, start: 0, text: 'value' }])).toBe('value');
  });
});
