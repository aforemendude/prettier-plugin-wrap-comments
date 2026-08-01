import { describe, expect, it } from 'vitest';

import { wrapTrailingLineComment } from '../../../src/comments/wrap-trailing-line-comment.js';
import { createWrapOptions } from '../support/wrap-options.js';

describe('wrapTrailingLineComment', () => {
  it('moves a trailing comment when wide characters make the line overflow', async () => {
    const text = 'const x = "\u6f22\u6f22\u6f22"; // note';
    const commentStart = text.indexOf('//');
    const comment = { end: text.length, kind: 'line' as const, start: commentStart };

    await expect(wrapTrailingLineComment(text, comment, createWrapOptions({ printWidth: 25 }))).resolves.toEqual([
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

    await expect(
      wrapTrailingLineComment(text, comment, createWrapOptions({ printWidth: 25 })),
    ).resolves.toBeUndefined();
  });

  it('uses configured newline sequences', async () => {
    const text = 'const value = compute(); // Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda.';
    const commentStart = text.indexOf('//');
    const comment = { end: text.length, kind: 'line' as const, start: commentStart };

    await expect(
      wrapTrailingLineComment(text, comment, createWrapOptions({ endOfLine: 'crlf', printWidth: 32 })),
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
