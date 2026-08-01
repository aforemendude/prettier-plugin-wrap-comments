import { describe, expect, it } from 'vitest';

import { getAvailableContentWidth, getPrintWidth, getTabWidth } from '../../../src/utils/wrap-options.js';
import { createWrapOptions } from '../support/wrap-options.js';

describe('getPrintWidth', () => {
  it('returns the configured width or the default', () => {
    expect(getPrintWidth(createWrapOptions({ printWidth: 100 }))).toBe(100);
    expect(getPrintWidth(createWrapOptions({ printWidth: undefined }))).toBe(80);
  });
});

describe('getTabWidth', () => {
  it('returns the configured width or the default', () => {
    expect(getTabWidth(createWrapOptions({ tabWidth: 4 }))).toBe(4);
    expect(getTabWidth(createWrapOptions({ tabWidth: undefined }))).toBe(2);
  });
});

describe('getAvailableContentWidth', () => {
  it('subtracts the content column from the print width', () => {
    expect(getAvailableContentWidth(createWrapOptions({ printWidth: 20 }), 7)).toBe(13);
  });

  it('keeps at least one available column', () => {
    expect(getAvailableContentWidth(createWrapOptions({ printWidth: 20 }), 20)).toBe(1);
    expect(getAvailableContentWidth(createWrapOptions({ printWidth: 20 }), 25)).toBe(1);
  });
});
