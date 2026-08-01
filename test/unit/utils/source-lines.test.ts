import { describe, expect, it } from 'vitest';

import { getPreferredNewline } from '../../../src/utils/source-lines.js';
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
