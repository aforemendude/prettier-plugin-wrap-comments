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

  it('accounts for preceding same-line block comment replacements in printer widths', async () => {
    const growingBlock = '/*x*/';
    const growingLineComment = '// word word';
    const shrinkingBlock = '/*    x    */';
    const shrinkingLineComment = '// word';
    const text = [
      `const grows = ${growingBlock} thing; ${growingLineComment}`,
      `const shrnk = ${shrinkingBlock} thing; ${shrinkingLineComment}`,
    ].join('\n');
    const entries = createCommentEntries(text, [
      growingBlock,
      growingLineComment,
      shrinkingBlock,
      shrinkingLineComment,
    ]);
    const ast = { comments: entries.map((entry) => entry.raw) };
    const expected = [growingLineComment, 'const grows = /* x */ thing;', 'const shrnk = /* x */ thing; // word'].join(
      '\n',
    );

    await expect(wrapComments(text, ast, createWrapOptions({ printWidth: 40 }))).resolves.toBe(expected);
    await expect(wrapComments(text, ast, createWrapOptions({ printWidth: 40 }), { ast, text })).resolves.toBe(expected);
  });

  it('moves direct trailing line comments before their embedded expression values', async () => {
    const jsxComment = '// This trailing JSX comment is deliberately wider than the print width.';
    const jsxText = [`<span>{value ${jsxComment}`, '}</span>'].join('\n');
    const jsxEntries = createCommentEntries(jsxText, [jsxComment]);
    const jsxContainerStart = jsxText.indexOf('{');
    const jsxContainerEnd = jsxText.indexOf('}') + 1;
    const templateComment = '// This trailing template comment is deliberately wider than the print width.';
    const templateText = ['const text = `prefix', `\${value ${templateComment}`, '}`;'].join('\n');
    const templateEntries = createCommentEntries(templateText, [templateComment]);
    const firstQuasiStart = templateText.indexOf('`') + 1;
    const interpolationStart = templateText.indexOf('${');
    const interpolationEnd = templateText.indexOf('}') + 1;

    await expect(
      wrapComments(
        jsxText,
        {
          body: [
            {
              end: jsxContainerEnd,
              expression: {
                end: jsxText.indexOf('value') + 'value'.length,
                start: jsxText.indexOf('value'),
                type: 'Identifier',
              },
              start: jsxContainerStart,
              type: 'JSXExpressionContainer',
            },
          ],
          comments: jsxEntries.map((entry) => entry.raw),
          type: 'Program',
        },
        createWrapOptions({ printWidth: 20 }),
      ),
    ).resolves.toBe(
      [
        '<span>{// This',
        '       // trailing',
        '       // JSX',
        '       // comment is',
        '       // deliberately',
        '       // wider than',
        '       // the print',
        '       // width.',
        '       value',
        '}</span>',
      ].join('\n'),
    );
    await expect(
      wrapComments(
        templateText,
        {
          body: [
            {
              end: templateText.lastIndexOf('`') + 1,
              expressions: [
                {
                  end: templateText.indexOf('value') + 'value'.length,
                  start: templateText.indexOf('value'),
                  type: 'Identifier',
                },
              ],
              quasis: [
                { end: interpolationStart, start: firstQuasiStart, type: 'TemplateElement' },
                { end: interpolationEnd, start: interpolationEnd, type: 'TemplateElement' },
              ],
              start: firstQuasiStart - 1,
              type: 'TemplateLiteral',
            },
          ],
          comments: templateEntries.map((entry) => entry.raw),
          type: 'Program',
        },
        createWrapOptions({ printWidth: 20 }),
      ),
    ).resolves.toBe(
      [
        'const text = `prefix',
        '${// This trailing',
        '  // template',
        '  // comment is',
        '  // deliberately',
        '  // wider than the',
        '  // print width.',
        '  value',
        '}`;',
      ].join('\n'),
    );
  });

  it('leaves ambiguous embedded trailing line comments in place', async () => {
    const nestedComment = '// This nested comment is deliberately wider than the print width.';
    const nestedText = [`<span>{{ value: item, ${nestedComment}`, '}}</span>'].join('\n');
    const nestedEntries = createCommentEntries(nestedText, [nestedComment]);
    const containerStart = nestedText.indexOf('{');
    const expressionStart = nestedText.indexOf('{', containerStart + 1);
    const expressionEnd = nestedText.indexOf('}');
    const spreadComment = '// This spread comment is deliberately wider than the print width.';
    const spreadText = [`<Component {...props ${spreadComment}`, '} />'].join('\n');
    const spreadEntries = createCommentEntries(spreadText, [spreadComment]);

    await expect(
      wrapComments(
        nestedText,
        {
          body: [
            {
              end: nestedText.lastIndexOf('}') + 1,
              expression: {
                end: expressionEnd + 1,
                start: expressionStart,
                type: 'ObjectExpression',
              },
              start: containerStart,
              type: 'JSXExpressionContainer',
            },
          ],
          comments: nestedEntries.map((entry) => entry.raw),
          type: 'Program',
        },
        createWrapOptions({ printWidth: 20 }),
      ),
    ).resolves.toBe(nestedText);
    await expect(
      wrapComments(
        spreadText,
        {
          body: [
            {
              end: spreadText.indexOf('}') + 1,
              start: spreadText.indexOf('{'),
              type: 'JSXSpreadAttribute',
            },
          ],
          comments: spreadEntries.map((entry) => entry.raw),
          type: 'Program',
        },
        createWrapOptions({ printWidth: 20 }),
      ),
    ).resolves.toBe(spreadText);
  });

  it('preserves statements around standalone comments separated by JavaScript Unicode line separators', async () => {
    const comment = '// Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda.';

    for (const separator of ['\u2028', '\u2029']) {
      const text = ['const before = 1;', comment, 'const after = 2;'].join(separator);
      const entries = createCommentEntries(text, [comment]);

      await expect(
        wrapComments(text, { comments: entries.map((entry) => entry.raw) }, createWrapOptions({ printWidth: 32 })),
      ).resolves.toBe(
        [
          'const before = 1;',
          ['// Alpha beta gamma delta', '// epsilon zeta eta theta iota', '// kappa lambda.'].join('\n'),
          'const after = 2;',
        ].join(separator),
      );
    }
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
