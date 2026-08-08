import { describe, expect, it } from 'vitest';

import { wrapBlockComment } from '../../../src/comments/wrap-block-comment.js';
import { createCommentRange } from '../support/comments.js';
import { createWrapOptions } from '../support/wrap-options.js';

describe('wrapBlockComment', () => {
  it('skips ineligible, unchanged, and overflowing inline block comments', async () => {
    const jsdocText = '/** documentation */';
    const directiveText = '/* eslint-disable no-console */';
    const unchangedText = '/* short */';
    const inlineText = 'value(/* Alpha beta gamma delta epsilon */);';

    await expect(
      wrapBlockComment(jsdocText, createCommentRange(jsdocText, jsdocText), createWrapOptions({})),
    ).resolves.toBeUndefined();
    await expect(
      wrapBlockComment(directiveText, createCommentRange(directiveText, directiveText), createWrapOptions({})),
    ).resolves.toBeUndefined();
    await expect(
      wrapBlockComment(unchangedText, createCommentRange(unchangedText, unchangedText), createWrapOptions({})),
    ).resolves.toBeUndefined();
    await expect(
      wrapBlockComment(
        inlineText,
        createCommentRange(inlineText, '/* Alpha beta gamma delta epsilon */'),
        createWrapOptions({
          printWidth: 20,
        }),
      ),
    ).resolves.toBeUndefined();
  });

  it('normalizes a fitting single-line block comment exactly', async () => {
    const text = '/*short*/';

    await expect(wrapBlockComment(text, createCommentRange(text, text), createWrapOptions({}))).resolves.toEqual({
      end: text.length,
      start: 0,
      text: '/* short */',
    });
  });

  it('preserves markdown list continuation indentation', async () => {
    const text = [
      '/*',
      ' * - first item has a very long description that should wrap beneath the marker',
      ' * - second item',
      ' *',
      ' * 1. first ordered item has a very long description that should wrap beneath the number',
      ' * 2. second item',
      ' */',
    ].join('\n');
    const comment = { end: text.length, kind: 'block' as const, start: 0 };

    await expect(wrapBlockComment(text, comment, createWrapOptions({ printWidth: 44 }))).resolves.toEqual({
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

  it('normalizes conventional blocks with JavaScript Unicode line separators', async () => {
    const lines = ['/*', ' * Alpha alpha alpha alpha.', ' * Beta beta beta beta.', ' */'];
    const expectedText = lines.join('\n');

    for (const separator of ['\u2028', '\u2029']) {
      const text = lines.join(separator);

      await expect(
        wrapBlockComment(text, createCommentRange(text, text), createWrapOptions({ printWidth: 30 })),
      ).resolves.toEqual({
        end: text.length,
        start: 0,
        text: expectedText,
      });
    }
  });

  it('uses configured newline sequences in multiline replacements', async () => {
    const text = '/* Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda. */';
    const comment = { end: text.length, kind: 'block' as const, start: 0 };

    await expect(
      wrapBlockComment(text, comment, createWrapOptions({ endOfLine: 'crlf', printWidth: 32 })),
    ).resolves.toEqual({
      end: text.length,
      start: 0,
      text: ['/*', ' * Alpha beta gamma delta', ' * epsilon zeta eta theta iota', ' * kappa lambda.', ' */'].join(
        '\r\n',
      ),
    });
  });

  it('uses detected CRLF newlines when endOfLine is auto', async () => {
    const text = ['/*', ' * Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda.', ' */'].join('\r\n');
    const comment = { end: text.length, kind: 'block' as const, start: 0 };

    await expect(
      wrapBlockComment(text, comment, createWrapOptions({ endOfLine: 'auto', printWidth: 32 })),
    ).resolves.toEqual({
      end: text.length,
      start: 0,
      text: ['/*', ' * Alpha beta gamma delta', ' * epsilon zeta eta theta iota', ' * kappa lambda.', ' */'].join(
        '\r\n',
      ),
    });
  });

  it('accounts for suffix width before selecting a single-line replacement', async () => {
    const text = '/* short */';

    await expect(
      wrapBlockComment(text, createCommentRange(text, text), createWrapOptions({ printWidth: 20 }), {
        placement: 'standalone',
        singleLineSuffixWidth: 10,
      }),
    ).resolves.toEqual({
      end: text.length,
      start: 0,
      text: ['/*', ' * short', ' */'].join('\n'),
    });
  });

  it('preserves an explicitly multiline layout when the normalized body fits on one line', async () => {
    const text = ['/*', '*short', '*/'].join('\n');

    await expect(
      wrapBlockComment(text, createCommentRange(text, text), createWrapOptions({}), {
        placement: 'standalone',
        preserveMultiline: true,
      }),
    ).resolves.toEqual({
      end: text.length,
      start: 0,
      text: ['/*', ' * short', ' */'].join('\n'),
    });
  });

  it('returns exact insertion and removal replacements for trailing and leading moves', async () => {
    const trailingText = 'value /* Alpha beta gamma delta epsilon */';
    const trailingComment = createCommentRange(trailingText, '/* Alpha beta gamma delta epsilon */');
    const leadingText = '/* Alpha beta gamma delta epsilon */ value';
    const leadingComment = createCommentRange(leadingText, '/* Alpha beta gamma delta epsilon */');
    const replacementText = ['/*', ' * Alpha beta gamma', ' * delta epsilon', ' */', ''].join('\n');

    await expect(
      wrapBlockComment(trailingText, trailingComment, createWrapOptions({ printWidth: 20 }), {
        markerColumn: 0,
        multilineIndent: '',
        placement: 'trailing',
        trailingMove: {
          insertAt: 0,
          removeEnd: trailingComment.end,
          removeStart: 'value'.length,
        },
      }),
    ).resolves.toEqual([
      { end: 0, start: 0, text: replacementText },
      { end: trailingComment.end, start: 'value'.length, text: '' },
    ]);
    await expect(
      wrapBlockComment(leadingText, leadingComment, createWrapOptions({ printWidth: 20 }), {
        leadingMove: { removeEnd: leadingText.indexOf('value'), removeStart: leadingComment.end },
        markerColumn: 0,
        multilineIndent: '',
        placement: 'standalone',
      }),
    ).resolves.toEqual([
      { end: leadingComment.end, start: leadingComment.start, text: replacementText },
      { end: leadingText.indexOf('value'), start: leadingComment.end, text: '' },
    ]);
  });
});
