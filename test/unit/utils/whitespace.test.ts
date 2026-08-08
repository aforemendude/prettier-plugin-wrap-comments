import { describe, expect, it } from 'vitest';

import { isEcmaScriptHorizontalWhitespace, skipWhitespace, trimWhitespaceEnd } from '../../../src/utils/whitespace.js';

describe('isEcmaScriptHorizontalWhitespace', () => {
  it('accepts the ECMAScript whitespace characters that are not line terminators', () => {
    const whitespace = [
      '\t',
      '\u000b',
      '\u000c',
      ' ',
      '\u00a0',
      '\u1680',
      '\u2000',
      '\u2001',
      '\u2002',
      '\u2003',
      '\u2004',
      '\u2005',
      '\u2006',
      '\u2007',
      '\u2008',
      '\u2009',
      '\u200a',
      '\u202f',
      '\u205f',
      '\u3000',
      '\ufeff',
    ];

    for (const character of whitespace) {
      expect(isEcmaScriptHorizontalWhitespace(character), `U+${character.codePointAt(0)?.toString(16)}`).toBe(true);
    }
  });

  it('rejects line terminators and non-whitespace text', () => {
    for (const character of ['\n', '\r', '\u2028', '\u2029', '\u0085', 'a', '', '  ']) {
      expect(isEcmaScriptHorizontalWhitespace(character), JSON.stringify(character)).toBe(false);
    }
  });
});

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
