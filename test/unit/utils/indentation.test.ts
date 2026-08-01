import { describe, expect, it } from 'vitest';

import { makeIndent } from '../../../src/utils/indentation.js';
import { createWrapOptions } from '../support/wrap-options.js';

describe('makeIndent', () => {
  it('creates indentation with spaces or tabs', () => {
    expect(makeIndent(6, createWrapOptions({ tabWidth: 4 }))).toBe('      ');
    expect(makeIndent(6, createWrapOptions({ tabWidth: 4, useTabs: true }))).toBe('\t  ');
    expect(makeIndent(6, createWrapOptions({ useTabs: true }))).toBe('\t\t\t');
    expect(makeIndent(10, createWrapOptions({ tabWidth: 8, useTabs: true }))).toBe('\t  ');
  });
});
