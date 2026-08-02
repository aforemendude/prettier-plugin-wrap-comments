import { describe, expect, it } from 'vitest';

import { wrapTrailingLineComment } from '../../../src/comments/wrap-trailing-line-comment.js';
import { createWrapOptions } from '../support/wrap-options.js';

describe('wrapTrailingLineComment', () => {
  it('returns undefined for whitespace-only code prefixes and comment bodies', async () => {
    const standaloneText = '   // long standalone comment';
    const standaloneComment = {
      end: standaloneText.length,
      kind: 'line' as const,
      start: standaloneText.indexOf('//'),
    };
    const blankBodyText = 'value(); //   ';
    const blankBodyComment = {
      end: blankBodyText.length,
      kind: 'line' as const,
      start: blankBodyText.indexOf('//'),
    };

    await expect(
      wrapTrailingLineComment(standaloneText, standaloneComment, createWrapOptions({ printWidth: 5 })),
    ).resolves.toBeUndefined();
    await expect(
      wrapTrailingLineComment(blankBodyText, blankBodyComment, createWrapOptions({ printWidth: 5 })),
    ).resolves.toBeUndefined();
  });

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

  it('limits trailing-comment removal to JavaScript Unicode line separators', async () => {
    for (const separator of ['\u2028', '\u2029']) {
      const commentText = '// Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda.';
      const text = [`const value = compute(); ${commentText}`, 'const after = 2;'].join(separator);
      const commentStart = text.indexOf('//');
      const lineEnd = text.indexOf(separator);
      const comment = { end: lineEnd, kind: 'line' as const, start: commentStart };

      await expect(wrapTrailingLineComment(text, comment, createWrapOptions({ printWidth: 32 }))).resolves.toEqual([
        {
          end: 0,
          start: 0,
          text: ['// Alpha beta gamma delta', '// epsilon zeta eta theta iota', '// kappa lambda.', ''].join('\n'),
        },
        {
          end: lineEnd,
          start: 'const value = compute();'.length,
          text: '',
        },
      ]);
    }
  });

  it('does not move a line-comment range across its JavaScript line boundary', async () => {
    const text = ['value(); // comment that overflows', 'const after = 2;'].join('\u2028');
    const comment = { end: text.length, kind: 'line' as const, start: text.indexOf('//') };

    await expect(
      wrapTrailingLineComment(text, comment, createWrapOptions({ printWidth: 10 })),
    ).resolves.toBeUndefined();
  });

  it('uses printer line measurements instead of the source line width', async () => {
    const longText = 'const value = computeSomethingExpensive(); // note';
    const longCommentStart = longText.indexOf('//');
    const longComment = { end: longText.length, kind: 'line' as const, start: longCommentStart };
    const shortText = 'x; // note';
    const shortCommentStart = shortText.indexOf('//');
    const shortComment = { end: shortText.length, kind: 'line' as const, start: shortCommentStart };

    await expect(
      wrapTrailingLineComment(longText, longComment, createWrapOptions({ printWidth: 20 }), {
        lineIndentColumn: 0,
        lineWidth: 20,
      }),
    ).resolves.toBeUndefined();
    await expect(
      wrapTrailingLineComment(shortText, shortComment, createWrapOptions({ printWidth: 20 }), {
        lineIndentColumn: 0,
        lineWidth: 21,
      }),
    ).resolves.toEqual([
      { end: 0, start: 0, text: ['// note', ''].join('\n') },
      { end: shortText.length, start: 'x;'.length, text: '' },
    ]);
  });

  it('indents comments moved from closing-delimiter lines by one additional level', async () => {
    const text = '  }); // closing comment that overflows';
    const commentStart = text.indexOf('//');
    const comment = { end: text.length, kind: 'line' as const, start: commentStart };

    await expect(wrapTrailingLineComment(text, comment, createWrapOptions({ printWidth: 30 }))).resolves.toEqual([
      {
        end: 0,
        start: 0,
        text: ['    // closing comment that', '    // overflows', ''].join('\n'),
      },
      { end: text.length, start: '  });'.length, text: '' },
    ]);
  });

  it('uses spaces for positive-column indentation when tabs have zero width', async () => {
    const text = '  }); // closing comment that overflows';
    const commentStart = text.indexOf('//');
    const comment = { end: text.length, kind: 'line' as const, start: commentStart };

    await expect(
      wrapTrailingLineComment(text, comment, createWrapOptions({ printWidth: 30, tabWidth: 0, useTabs: true })),
    ).resolves.toEqual([
      {
        end: 0,
        start: 0,
        text: ['  // closing comment that', '  // overflows', ''].join('\n'),
      },
      { end: text.length, start: '  });'.length, text: '' },
    ]);
  });
});
