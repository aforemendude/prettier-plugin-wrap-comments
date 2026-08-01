import { describe, expect, it } from 'vitest';

import { wrapBlockComment } from '../../../src/comments/block.js';
import { getWrapOptions } from '../support/options.js';

describe('wrapBlockComment', () => {
  it('preserves markdown list continuation indentation', async () => {
    const text = [
        '/*',
        ' * - first item has a very long description that should wrap beneath the marker',
        ' * - second item',
        ' *',
        ' * 1. first ordered item has a very long description that should wrap beneath the number',
        ' * 2. second item',
        ' */',
      ].join('\n'),
      comment = { end: text.length, kind: 'block' as const, start: 0 };

    await expect(wrapBlockComment(text, comment, getWrapOptions({ printWidth: 44 }))).resolves.toEqual({
      end: text.length,
      start: 0,
      text: [
        '/*',
        ' * - first item has a very long description',
        ' *   that should wrap beneath the marker',
        ' * - second item',
        ' *',
        ' * 1. first ordered item has a very long',
        ' *    description that should wrap beneath',
        ' *    the number',
        ' * 2. second item',
        ' */',
      ].join('\n'),
    });
  });

  it('uses configured newline sequences in multiline replacements', async () => {
    const text = '/* Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda. */',
      comment = { end: text.length, kind: 'block' as const, start: 0 };

    await expect(
      wrapBlockComment(text, comment, getWrapOptions({ endOfLine: 'crlf', printWidth: 32 })),
    ).resolves.toEqual({
      end: text.length,
      start: 0,
      text: '/*\r\n * Alpha beta gamma delta\r\n * epsilon zeta eta theta iota\r\n * kappa lambda.\r\n */',
    });
  });

  it('uses detected CRLF newlines when endOfLine is auto', async () => {
    const text = '/*\r\n * Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda.\r\n */',
      comment = { end: text.length, kind: 'block' as const, start: 0 };

    await expect(
      wrapBlockComment(text, comment, getWrapOptions({ endOfLine: 'auto', printWidth: 32 })),
    ).resolves.toEqual({
      end: text.length,
      start: 0,
      text: '/*\r\n * Alpha beta gamma delta\r\n * epsilon zeta eta theta iota\r\n * kappa lambda.\r\n */',
    });
  });
});
