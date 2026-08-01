import { describe, expect, it } from 'vitest';

import { wrapComments } from '../../../src/comments/wrap-comments.js';
import { createCommentEntries } from '../support/comments.js';
import { createWrapOptions } from '../support/wrap-options.js';

describe('wrapComments', () => {
  it('returns source without comments unchanged', async () => {
    const text = 'const value = 1;';

    await expect(wrapComments(text, { comments: [] }, createWrapOptions({}))).resolves.toBe(text);
  });

  it('leaves directive comments unchanged', async () => {
    const text = '// eslint-disable-next-line no-console';
    const entries = createCommentEntries(text, [text]);

    await expect(
      wrapComments(text, { comments: entries.map((entry) => entry.raw) }, createWrapOptions({ printWidth: 10 })),
    ).resolves.toBe(text);
  });

  it('wraps a standalone line comment and normalizes a block comment', async () => {
    const lineText = '// Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda.';
    const lineEntries = createCommentEntries(lineText, [lineText]);
    const blockText = '/*short*/';
    const blockEntries = createCommentEntries(blockText, [blockText]);

    await expect(
      wrapComments(
        lineText,
        { comments: lineEntries.map((entry) => entry.raw) },
        createWrapOptions({ printWidth: 32 }),
      ),
    ).resolves.toBe(['// Alpha beta gamma delta', '// epsilon zeta eta theta iota', '// kappa lambda.'].join('\n'));
    await expect(
      wrapComments(blockText, { comments: blockEntries.map((entry) => entry.raw) }, createWrapOptions({})),
    ).resolves.toBe('/* short */');
  });

  it('moves an overflowing trailing line comment before its code', async () => {
    const text = 'const x = "\u6f22\u6f22\u6f22"; // note';
    const entries = createCommentEntries(text, ['// note']);

    await expect(
      wrapComments(text, { comments: entries.map((entry) => entry.raw) }, createWrapOptions({ printWidth: 25 })),
    ).resolves.toBe(['// note', 'const x = "\u6f22\u6f22\u6f22";'].join('\n'));
  });

  it('skips the entire ignored line-comment group and resumes after it', async () => {
    const ignoredFirst = '// This ignored first comment is deliberately much wider than the print width.';
    const ignoredSecond = '// This ignored second comment is also deliberately much wider than the print width.';
    const ordinary = '// Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda.';
    const text = ['// prettier-ignore', ignoredFirst, ignoredSecond, '', ordinary].join('\n');
    const entries = createCommentEntries(text, ['// prettier-ignore', ignoredFirst, ignoredSecond, ordinary]);

    await expect(
      wrapComments(text, { comments: entries.map((entry) => entry.raw) }, createWrapOptions({ printWidth: 32 })),
    ).resolves.toBe(
      [
        '// prettier-ignore',
        ignoredFirst,
        ignoredSecond,
        '',
        '// Alpha beta gamma delta',
        '// epsilon zeta eta theta iota',
        '// kappa lambda.',
      ].join('\n'),
    );
  });

  it('leaves comments inside a prettier-ignored node line unchanged', async () => {
    const trailing = '// This trailing comment is deliberately wider than the print width.';
    const text = ['// prettier-ignore', `const value = compute(); ${trailing}`].join('\n');
    const entries = createCommentEntries(text, ['// prettier-ignore', trailing]);
    const targetStart = text.indexOf('const value');
    const targetEnd = text.indexOf(';', targetStart) + 1;
    const ast = {
      body: [{ end: targetEnd, start: targetStart, type: 'VariableDeclaration' }],
      comments: entries.map((entry) => entry.raw),
      type: 'Program',
    };

    await expect(wrapComments(text, ast, createWrapOptions({ printWidth: 32 }))).resolves.toBe(text);
  });
});
