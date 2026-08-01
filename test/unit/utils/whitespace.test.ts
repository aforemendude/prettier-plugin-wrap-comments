import { describe, expect, it } from 'vitest';

import { skipWhitespace, trimWhitespaceEnd } from '../../../src/utils/whitespace.js';

describe('skipWhitespace', () => {
  it('advances across ASCII and Unicode whitespace', () => {
    const text = '\t \n\u00a0value';

    expect(skipWhitespace(text, 0)).toBe(text.indexOf('value'));
  });

  it('stops at nonwhitespace and at the end of the input', () => {
    const text = 'value';

    expect(skipWhitespace(text, 0)).toBe(0);
    expect(skipWhitespace(text, text.length)).toBe(text.length);
  });
});

describe('trimWhitespaceEnd', () => {
  it('moves the end offset before trailing ASCII and Unicode whitespace', () => {
    const text = 'value \t\n\u00a0';

    expect(trimWhitespaceEnd(text, 0, text.length)).toBe('value'.length);
  });

  it('stops at the lower bound or a nonwhitespace ending', () => {
    expect(trimWhitespaceEnd('a   ', 2, 4)).toBe(2);
    expect(trimWhitespaceEnd('value', 0, 5)).toBe(5);
  });
});
