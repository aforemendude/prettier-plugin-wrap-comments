import { describe, expect, it } from 'vitest';

import { wrapLineCommentGroup, wrapTrailingLineComment } from '../../../src/comments/line.js';
import type { CommentRange } from '../../../src/shared/types.js';
import { getWrapOptions } from '../support/options.js';

describe('wrapLineCommentGroup', () => {
  it('preserves markdown list continuation indentation', async () => {
    const text = [
      '// - first item has a very long description that should wrap beneath the marker',
      '// - second item',
      '//',
      '// 1. first ordered item has a very long description that should wrap beneath the number',
      '// 2. second item',
    ].join('\n');
    const comments = collectLineCommentRanges(text);

    await expect(wrapLineCommentGroup(text, comments, getWrapOptions({ printWidth: 44 }))).resolves.toEqual({
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

    await expect(wrapLineCommentGroup(text, [comment], getWrapOptions({ endOfLine, printWidth: 32 }))).resolves.toEqual(
      {
        end: text.length,
        start: 0,
        text: ['// Alpha beta gamma delta', '// epsilon zeta eta theta iota', '// kappa lambda.'].join(newline),
      },
    );
  });
});

describe('wrapTrailingLineComment', () => {
  it('moves a trailing comment when wide characters make the line overflow', async () => {
    const text = 'const x = "\u6f22\u6f22\u6f22"; // note';
    const commentStart = text.indexOf('//');
    const comment = { end: text.length, kind: 'line' as const, start: commentStart };

    await expect(wrapTrailingLineComment(text, comment, getWrapOptions({ printWidth: 25 }))).resolves.toEqual([
      {
        end: 0,
        start: 0,
        text: ['// note', ''].join('\n'),
      },
      {
        end: text.length,
        start: commentStart - 1,
        text: '',
      },
    ]);
  });

  it('keeps a trailing comment when combining marks leave the line within the print width', async () => {
    const text = 'const x = "e\u0301e\u0301e\u0301"; // note';
    const commentStart = text.indexOf('//');
    const comment = { end: text.length, kind: 'line' as const, start: commentStart };

    await expect(wrapTrailingLineComment(text, comment, getWrapOptions({ printWidth: 25 }))).resolves.toBeUndefined();
  });

  it('uses configured newline sequences', async () => {
    const text = 'const value = compute(); // Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda.';
    const commentStart = text.indexOf('//');
    const comment = { end: text.length, kind: 'line' as const, start: commentStart };

    await expect(
      wrapTrailingLineComment(text, comment, getWrapOptions({ endOfLine: 'crlf', printWidth: 32 })),
    ).resolves.toEqual([
      {
        end: 0,
        start: 0,
        text: ['// Alpha beta gamma delta', '// epsilon zeta eta theta iota', '// kappa lambda.', ''].join('\r\n'),
      },
      {
        end: text.length,
        start: commentStart - 1,
        text: '',
      },
    ]);
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
