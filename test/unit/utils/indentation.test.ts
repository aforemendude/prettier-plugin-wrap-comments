import { describe, expect, it } from 'vitest';

import { getContinuationIndent, getLeadingIndent, makeIndent } from '../../../src/utils/indentation.js';
import { createWrapOptions } from '../support/wrap-options.js';

describe('getContinuationIndent', () => {
  it('preserves the source whitespace before a standalone comment', () => {
    const text = '\t  // comment';
    const commentStart = text.indexOf('//');

    expect(getContinuationIndent(text, commentStart, 20, createWrapOptions({}))).toBe('\t  ');
  });

  it('builds indentation to the marker column after code', () => {
    const text = 'const value = 1; // comment';
    const commentStart = text.indexOf('//');

    expect(getContinuationIndent(text, commentStart, 6, createWrapOptions({ tabWidth: 4, useTabs: true }))).toBe(
      '\t  ',
    );
  });
});

describe('getLeadingIndent', () => {
  it('returns only leading spaces and tabs', () => {
    expect(getLeadingIndent('\t  value')).toBe('\t  ');
    expect(getLeadingIndent('value')).toBe('');
    expect(getLeadingIndent('')).toBe('');
  });
});

describe('makeIndent', () => {
  it('creates indentation with spaces or tabs', () => {
    expect(makeIndent(6, createWrapOptions({ tabWidth: 4 }))).toBe('      ');
    expect(makeIndent(6, createWrapOptions({ tabWidth: 4, useTabs: true }))).toBe('\t  ');
    expect(makeIndent(6, createWrapOptions({ useTabs: true }))).toBe('\t\t\t');
    expect(makeIndent(10, createWrapOptions({ tabWidth: 8, useTabs: true }))).toBe('\t  ');
    expect(makeIndent(0, createWrapOptions({ useTabs: true }))).toBe('');
  });
});
