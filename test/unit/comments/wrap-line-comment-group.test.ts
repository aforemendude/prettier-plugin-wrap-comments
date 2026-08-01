import { describe, expect, it } from 'vitest';

import type { CommentRange } from '../../../src/comments/comment-ranges.js';
import { wrapLineCommentGroup } from '../../../src/comments/wrap-line-comment-group.js';
import { createWrapOptions } from '../support/wrap-options.js';

describe('wrapLineCommentGroup', () => {
  it('returns undefined for missing, blank, and already formatted groups', async () => {
    const blankText = ['//', '//   '].join('\n');
    const blankComments = collectLineCommentRanges(blankText);
    const formattedText = '// short';
    const formattedComment = { end: formattedText.length, kind: 'line' as const, start: 0 };

    await expect(wrapLineCommentGroup('', [], createWrapOptions({}))).resolves.toBeUndefined();
    await expect(wrapLineCommentGroup(blankText, blankComments, createWrapOptions({}))).resolves.toBeUndefined();
    await expect(
      wrapLineCommentGroup(formattedText, [formattedComment], createWrapOptions({})),
    ).resolves.toBeUndefined();
  });

  it('preserves markdown list continuation indentation', async () => {
    const text = [
      '// - first item has a very long description that should wrap beneath the marker',
      '// - second item',
      '//',
      '// 1. first ordered item has a very long description that should wrap beneath the number',
      '// 2. second item',
    ].join('\n');
    const comments = collectLineCommentRanges(text);

    await expect(wrapLineCommentGroup(text, comments, createWrapOptions({ printWidth: 44 }))).resolves.toEqual({
      end: text.length,
      start: 0,
      text: [
        '// - first item has a very long description',
        '//   that should wrap beneath the marker',
        '// - second item',
        '//',
        '// 1. first ordered item has a very long',
        '//    description that should wrap beneath',
        '//    the number',
        '// 2. second item',
      ].join('\n'),
    });
  });

  it.each([
    ['lf', '\n'],
    ['crlf', '\r\n'],
    ['cr', '\r'],
  ] as const)('uses the configured %s newline sequence', async (endOfLine, newline) => {
    const text = '// Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda.';
    const comment = { end: text.length, kind: 'line' as const, start: 0 };

    await expect(
      wrapLineCommentGroup(text, [comment], createWrapOptions({ endOfLine, printWidth: 32 })),
    ).resolves.toEqual({
      end: text.length,
      start: 0,
      text: ['// Alpha beta gamma delta', '// epsilon zeta eta theta iota', '// kappa lambda.'].join(newline),
    });
  });

  it('uses the printer marker column to determine available content width', async () => {
    const text = '// Alpha beta gamma delta epsilon zeta.';
    const comment = { end: text.length, kind: 'line' as const, start: 0 };

    await expect(wrapLineCommentGroup(text, [comment], createWrapOptions({ printWidth: 24 }), 6)).resolves.toEqual({
      end: text.length,
      start: 0,
      text: ['// Alpha beta', '// gamma delta', '// epsilon zeta.'].join('\n'),
    });
  });
});

function collectLineCommentRanges(text: string): CommentRange[] {
  return Array.from(text.matchAll(/\/\/[^\n]*/gu), (match) => {
    const start = match.index ?? 0;

    return {
      end: start + match[0].length,
      kind: 'line',
      start,
    };
  });
}
