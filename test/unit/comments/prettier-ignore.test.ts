import { describe, expect, it } from 'vitest';

import {
  collectPrettierIgnoredLineRanges,
  isCommentInIgnoredLineRange,
  isPrettierIgnoredBlockComment,
  isPrettierIgnoredStandaloneLineComment,
  isPrettierIgnoredTrailingLineComment,
  neutralizePrettierIgnoreForIgnoredComments,
} from '../../../src/comments/prettier-ignore.js';
import type { CommentEntry } from '../../../src/comments/comment-ranges.js';
import { createCommentEntries } from '../support/comments.js';

describe('neutralizePrettierIgnoreForIgnoredComments', () => {
  it.each([
    ['standalone line', '// ordinary target'],
    ['standalone block', '/* ordinary target */'],
  ] as const)('neutralizes the ignore directive before an eligible %s comment', (_name, target) => {
    const text = ['// prettier-ignore', target].join('\n');
    const entries = createCommentEntries(text, ['// prettier-ignore', target]);
    const ast = { comments: entries.map((entry) => entry.raw) };

    expect(neutralizePrettierIgnoreForIgnoredComments(text, ast)).toBe(ast);
    expect(entries[0]?.raw.value).toBe('prettier-ignore wrap-comments');
    expect(entries[1]?.raw.value).toBe(target.startsWith('//') ? ' ordinary target' : ' ordinary target ');
  });

  it('preserves the ignore directive when the ignored comment is itself ineligible', () => {
    const text = ['// prettier-ignore', '// eslint-disable-next-line no-console'].join('\n');
    const entries = createCommentEntries(text, ['// prettier-ignore', '// eslint-disable-next-line no-console']);
    const ast = { comments: entries.map((entry) => entry.raw) };

    neutralizePrettierIgnoreForIgnoredComments(text, ast);

    expect(entries.map((entry) => entry.raw.value)).toEqual([
      ' prettier-ignore',
      ' eslint-disable-next-line no-console',
    ]);
  });
});

describe('collectPrettierIgnoredLineRanges', () => {
  it('collects the whole target line after skippable directive comments', () => {
    const text = [
      '// prettier-ignore',
      '// eslint-disable-next-line no-console',
      'const value = compute(); // trailing',
      'next();',
    ].join('\n');
    const entries = createCommentEntries(text, [
      '// prettier-ignore',
      '// eslint-disable-next-line no-console',
      '// trailing',
    ]);
    const targetStart = text.indexOf('const value');
    const targetEnd = text.indexOf(';', targetStart) + 1;
    const ast = {
      body: [{ end: targetEnd, start: targetStart, type: 'VariableDeclaration' }],
      comments: entries.map((entry) => entry.raw),
      type: 'Program',
    };

    expect(collectPrettierIgnoredLineRanges(text, ast, entries)).toEqual([
      { end: text.indexOf('\n', targetStart), start: targetStart },
    ]);
  });

  it('rejects invalid ignore-to-target relationships', () => {
    const cases = [
      {
        comments: ['// prettier-ignore'],
        name: 'non-standalone ignore',
        nodeStart: (text: string) => text.indexOf('next'),
        text: ['value(); // prettier-ignore', 'next();'].join('\n'),
      },
      {
        comments: ['// prettier-ignore', '// ordinary'],
        name: 'ordinary intervening comment',
        nodeStart: (text: string) => text.indexOf('next'),
        text: ['// prettier-ignore', '// ordinary', 'next();'].join('\n'),
      },
      {
        comments: ['// prettier-ignore'],
        name: 'missing target',
        nodeStart: () => 0,
        text: '// prettier-ignore',
      },
      {
        comments: ['// prettier-ignore'],
        name: 'unmatched AST node start',
        nodeStart: (text: string) => text.indexOf('next') + 1,
        text: ['// prettier-ignore', 'next();'].join('\n'),
      },
    ];

    for (const testCase of cases) {
      const entries = createCommentEntries(testCase.text, testCase.comments);
      const nodeStart = testCase.nodeStart(testCase.text);
      const ast = {
        body: [{ end: nodeStart + 1, start: nodeStart, type: 'ExpressionStatement' }],
        comments: entries.map((entry) => entry.raw),
        type: 'Program',
      };

      expect(collectPrettierIgnoredLineRanges(testCase.text, ast, entries), testCase.name).toEqual([]);
    }
  });

  it('merges ignored line ranges when an ignored target contains another ignored target', () => {
    const text = [
      '// prettier-ignore',
      'if (condition) {',
      '  // prettier-ignore',
      '  const value = compute();',
      '}',
    ].join('\n');
    const entries = createCommentEntries(text, ['// prettier-ignore', '// prettier-ignore']);
    const ifStart = text.indexOf('if (condition)');
    const declarationStart = text.indexOf('const value');
    const ast = {
      body: [
        {
          body: {
            body: [
              {
                end: text.indexOf(';', declarationStart) + 1,
                start: declarationStart,
                type: 'VariableDeclaration',
              },
            ],
            end: text.length,
            start: text.indexOf('{', ifStart),
            type: 'BlockStatement',
          },
          end: text.length,
          start: ifStart,
          type: 'IfStatement',
        },
      ],
      comments: entries.map((entry) => entry.raw),
      type: 'Program',
    };

    expect(collectPrettierIgnoredLineRanges(text, ast, entries)).toEqual([{ end: text.length, start: ifStart }]);
  });
});

describe('isCommentInIgnoredLineRange', () => {
  it('uses an inclusive start and exclusive end boundary', () => {
    const ignoredLineRange = { end: 20, start: 10 };

    expect(isCommentInIgnoredLineRange({ end: 12, kind: 'line', start: 10 }, ignoredLineRange)).toBe(true);
    expect(isCommentInIgnoredLineRange({ end: 21, kind: 'line', start: 19 }, ignoredLineRange)).toBe(true);
    expect(isCommentInIgnoredLineRange({ end: 22, kind: 'line', start: 20 }, ignoredLineRange)).toBe(false);
    expect(isCommentInIgnoredLineRange({ end: 12, kind: 'line', start: 10 }, undefined)).toBe(false);
  });
});

describe('isPrettierIgnoredBlockComment', () => {
  it('recognizes an adjacent standalone block target', () => {
    const text = ['// prettier-ignore', '/* target */'].join('\n');
    const entries = createCommentEntries(text, ['// prettier-ignore', '/* target */']);

    expect(isPrettierIgnoredBlockComment(text, entries, 1)).toBe(true);
  });

  it('rejects missing, inline, separated, and non-ignore predecessors', () => {
    const cases = [
      createCase('/* target */', ['/* target */']),
      createCase(['// prettier-ignore', 'value(); /* target */'].join('\n'), ['// prettier-ignore', '/* target */']),
      createCase(['// prettier-ignore', '', '/* target */'].join('\n'), ['// prettier-ignore', '/* target */']),
      createCase(['// ordinary', '/* target */'].join('\n'), ['// ordinary', '/* target */']),
    ];

    for (const testCase of cases) {
      expect(isPrettierIgnoredBlockComment(testCase.text, testCase.entries, testCase.entries.length - 1)).toBe(false);
    }
  });
});

describe('isPrettierIgnoredStandaloneLineComment', () => {
  it('recognizes an adjacent standalone line target', () => {
    const text = ['// prettier-ignore', '// target'].join('\n');
    const entries = createCommentEntries(text, ['// prettier-ignore', '// target']);

    expect(isPrettierIgnoredStandaloneLineComment(text, entries, 1)).toBe(true);
  });

  it('requires a standalone target and a preceding line-form ignore', () => {
    const blockIgnoreText = ['/* prettier-ignore */', '// target'].join('\n');
    const blockIgnoreEntries = createCommentEntries(blockIgnoreText, ['/* prettier-ignore */', '// target']);
    const trailingText = ['// prettier-ignore', 'value(); // target'].join('\n');
    const trailingEntries = createCommentEntries(trailingText, ['// prettier-ignore', '// target']);

    expect(isPrettierIgnoredStandaloneLineComment(blockIgnoreText, blockIgnoreEntries, 1)).toBe(false);
    expect(isPrettierIgnoredStandaloneLineComment(trailingText, trailingEntries, 1)).toBe(false);
    expect(
      isPrettierIgnoredStandaloneLineComment('// target', createCommentEntries('// target', ['// target']), 0),
    ).toBe(false);
  });
});

describe('isPrettierIgnoredTrailingLineComment', () => {
  it('finds a preceding ignore through skippable directive comments', () => {
    const text = ['// prettier-ignore', '// eslint-disable-next-line no-console', 'value(); // target'].join('\n');
    const entries = createCommentEntries(text, [
      '// prettier-ignore',
      '// eslint-disable-next-line no-console',
      '// target',
    ]);

    expect(isPrettierIgnoredTrailingLineComment(text, entries, 2)).toBe(true);
  });

  it('stops at ordinary comments and non-adjacent ignore directives', () => {
    const ordinaryText = ['// prettier-ignore', '// ordinary', 'value(); // target'].join('\n');
    const ordinaryEntries = createCommentEntries(ordinaryText, ['// prettier-ignore', '// ordinary', '// target']);
    const separatedText = ['// prettier-ignore', '', 'value(); // target'].join('\n');
    const separatedEntries = createCommentEntries(separatedText, ['// prettier-ignore', '// target']);

    expect(isPrettierIgnoredTrailingLineComment(ordinaryText, ordinaryEntries, 2)).toBe(false);
    expect(isPrettierIgnoredTrailingLineComment(separatedText, separatedEntries, 1)).toBe(false);
    expect(
      isPrettierIgnoredTrailingLineComment(
        '// standalone',
        createCommentEntries('// standalone', ['// standalone']),
        0,
      ),
    ).toBe(false);
  });
});

function createCase(text: string, rawComments: string[]): { entries: CommentEntry[]; text: string } {
  return { entries: createCommentEntries(text, rawComments), text };
}
