import { describe, expect, it } from 'vitest';

import {
  getLineEnd,
  getLinePrefix,
  getLineStart,
  getPreferredNewline,
  isBlankLine,
  normalizeLineTerminators,
} from '../../../src/utils/source-lines.js';
import { createWrapOptions } from '../support/wrap-options.js';

describe('getPreferredNewline', () => {
  it('selects the configured or detected newline sequence', () => {
    const crlfThenLfText = [['a', 'b'].join('\r\n'), ''].join('\n');
    const lfText = ['a', 'b', ''].join('\n');
    const crThenLfText = [['a', 'b'].join('\r'), ''].join('\n');

    expect(getPreferredNewline(crlfThenLfText, createWrapOptions({ endOfLine: 'lf' }))).toBe('\n');
    expect(getPreferredNewline(lfText, createWrapOptions({ endOfLine: 'crlf' }))).toBe('\r\n');
    expect(getPreferredNewline(lfText, createWrapOptions({ endOfLine: 'cr' }))).toBe('\r');
    expect(getPreferredNewline(crlfThenLfText, createWrapOptions({ endOfLine: 'auto' }))).toBe('\r\n');
    expect(getPreferredNewline(crThenLfText, createWrapOptions({ endOfLine: 'auto' }))).toBe('\r');
    expect(getPreferredNewline('single line', createWrapOptions({ endOfLine: 'auto' }))).toBe('\n');
  });
});

describe('normalizeLineTerminators', () => {
  it('normalizes every supported JavaScript line terminator', () => {
    expect(normalizeLineTerminators(['alpha', 'beta', 'gamma', 'delta', 'epsilon'].join('\n'))).toBe(
      ['alpha', 'beta', 'gamma', 'delta', 'epsilon'].join('\n'),
    );
    expect(normalizeLineTerminators('alpha\r\nbeta\rgamma\u2028delta\u2029epsilon')).toBe(
      ['alpha', 'beta', 'gamma', 'delta', 'epsilon'].join('\n'),
    );
  });
});

describe('line boundaries', () => {
  it('locates prefixes and boundaries on LF-separated lines', () => {
    const text = ['alpha', 'beta', 'gamma'].join('\n');
    const betaStart = text.indexOf('beta');
    const betaIndex = betaStart + 2;
    const gammaStart = text.indexOf('gamma');

    expect(getLineStart(text, 2)).toBe(0);
    expect(getLineEnd(text, 2)).toBe('alpha'.length);
    expect(getLineStart(text, betaIndex)).toBe(betaStart);
    expect(getLinePrefix(text, betaIndex)).toBe('be');
    expect(getLineEnd(text, betaIndex)).toBe(betaStart + 'beta'.length);
    expect(getLineEnd(text, gammaStart)).toBe(text.length);
  });

  it('excludes the carriage return from CRLF line endings', () => {
    const text = ['alpha', 'beta'].join('\r\n');
    const betaStart = text.indexOf('beta');

    expect(getLineEnd(text, 0)).toBe('alpha'.length);
    expect(getLineStart(text, betaStart)).toBe(betaStart);
    expect(getLinePrefix(text, betaStart)).toBe('');
  });

  it('locates prefixes and boundaries on CR-separated lines', () => {
    const text = ['alpha', 'beta', 'gamma'].join('\r');
    const betaStart = text.indexOf('beta');
    const betaIndex = betaStart + 2;
    const gammaStart = text.indexOf('gamma');

    expect(getLineEnd(text, 2)).toBe('alpha'.length);
    expect(getLineStart(text, betaIndex)).toBe(betaStart);
    expect(getLinePrefix(text, betaIndex)).toBe('be');
    expect(getLineEnd(text, betaIndex)).toBe(betaStart + 'beta'.length);
    expect(getLineStart(text, gammaStart)).toBe(gammaStart);
  });

  it('locates prefixes and boundaries on JavaScript Unicode line separators', () => {
    for (const separator of ['\u2028', '\u2029']) {
      const text = ['alpha', 'beta', 'gamma'].join(separator);
      const betaStart = text.indexOf('beta');
      const betaIndex = betaStart + 2;
      const gammaStart = text.indexOf('gamma');

      expect(getLineEnd(text, 2)).toBe('alpha'.length);
      expect(getLineStart(text, betaIndex)).toBe(betaStart);
      expect(getLinePrefix(text, betaIndex)).toBe('be');
      expect(getLineEnd(text, betaIndex)).toBe(betaStart + 'beta'.length);
      expect(getLineStart(text, gammaStart)).toBe(gammaStart);
    }
  });
});

describe('isBlankLine', () => {
  it('accepts empty and whitespace-only lines', () => {
    expect(isBlankLine('')).toBe(true);
    expect(isBlankLine(' \t')).toBe(true);
  });

  it('rejects missing and nonblank lines', () => {
    expect(isBlankLine(undefined)).toBe(false);
    expect(isBlankLine(' value ')).toBe(false);
  });
});
