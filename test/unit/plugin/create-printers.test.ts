import type { AstPath, Doc, ParserOptions, Printer } from 'prettier';
import { doc } from 'prettier';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type AstNode = Record<string, unknown>;
type PrintFunction = Parameters<Printer<AstNode>['print']>[2];

const mocks = vi.hoisted(() => {
  const estreePreprocess = vi.fn();
  const nativePrint = vi.fn();
  const nativePrintComment = vi.fn();
  const estreePrinter = {
    preprocess: estreePreprocess,
    print: nativePrint,
    printComment: nativePrintComment,
  };
  const jsonPrinter = { print: vi.fn() };

  return {
    estreePreprocess,
    estreePrinter,
    jsonPrinter,
    nativePrint,
    nativePrintComment,
  };
});

vi.mock('prettier/plugins/estree', () => ({
  printers: {
    estree: mocks.estreePrinter,
    'estree-json': mocks.jsonPrinter,
  },
}));

import { createPrinters } from '../../../src/plugin/create-printers.js';
import { neutralizePrettierIgnoreForIgnoredComments } from '../../../src/comments/prettier-ignore.js';
import {
  markRewrittenJsxBlockComments,
  setJsxBlockCommentRewrites,
} from '../../../src/plugin/jsx-comment-rewrite-metadata.js';
import { createCommentEntries } from '../support/comments.js';

const { hardline, indent } = doc.builders;
const { replaceEndOfLine } = doc.utils;
const blockCommentTypes = ['Block', 'CommentBlock'] as const;
const lineTerminatorCases = [
  { name: 'LF', separator: '\n' },
  { name: 'CR', separator: '\r' },
  { name: 'line separator', separator: '\u2028' },
  { name: 'paragraph separator', separator: '\u2029' },
] as const;
const multilineBlockCommentCases = blockCommentTypes.flatMap((type) =>
  lineTerminatorCases.map(({ name, separator }) => ({ name, separator, type })),
);
const fallbackCases = [
  { name: 'a non-object node', node: undefined },
  { name: 'another AST node type', node: { type: 'Identifier' } },
  { name: 'a missing expression', node: { type: 'JSXExpressionContainer' } },
  {
    name: 'another expression type',
    node: { expression: { type: 'Identifier' }, type: 'JSXExpressionContainer' },
  },
  {
    name: 'missing comments',
    node: { expression: { type: 'JSXEmptyExpression' }, type: 'JSXExpressionContainer' },
  },
  {
    name: 'non-array comments',
    node: {
      expression: { comments: {}, type: 'JSXEmptyExpression' },
      type: 'JSXExpressionContainer',
    },
  },
  {
    name: 'a non-object comment',
    node: {
      expression: { comments: [undefined], type: 'JSXEmptyExpression' },
      type: 'JSXExpressionContainer',
    },
  },
  {
    name: 'another comment type',
    node: {
      expression: {
        comments: [{ type: 'Line', value: ['first', 'second'].join('\n') }],
        type: 'JSXEmptyExpression',
      },
      type: 'JSXExpressionContainer',
    },
  },
  {
    name: 'a non-string block comment',
    node: {
      expression: { comments: [{ type: 'Block', value: 1 }], type: 'JSXEmptyExpression' },
      type: 'JSXExpressionContainer',
    },
  },
  {
    name: 'a single-line block comment',
    node: {
      expression: { comments: [{ type: 'Block', value: 'single line' }], type: 'JSXEmptyExpression' },
      type: 'JSXExpressionContainer',
    },
  },
  {
    name: 'an unmarked multiline block comment',
    node: {
      expression: {
        comments: [{ type: 'Block', value: ['first line', 'second line'].join('\n') }],
        type: 'JSXEmptyExpression',
      },
      type: 'JSXExpressionContainer',
    },
  },
] as const;

describe('createPrinters', () => {
  beforeEach(() => {
    mocks.nativePrint.mockReset();
    mocks.nativePrintComment.mockReset();
  });

  it('exports only the wrapped estree printer while preserving its native hooks', () => {
    const printers = createPrinters();
    const estreePrinter = getEstreePrinter(printers);

    expect(Object.keys(printers)).toEqual(['estree']);
    expect(estreePrinter).not.toBe(mocks.estreePrinter);
    expect(estreePrinter.preprocess).toBe(mocks.estreePreprocess);
    expect(estreePrinter.print).not.toBe(mocks.nativePrint);
    expect(estreePrinter.printComment).not.toBe(mocks.nativePrintComment);
  });

  it('prints a neutralized block-form ignore directive from its original text', () => {
    const marker = '/* prettier-ignore */';
    const target = '/* ordinary target */';
    const text = [marker, target].join('\n');
    const entries = createCommentEntries(text, [marker, target]);
    const ast = { comments: entries.map((entry) => entry.raw) };
    const path = createPath(entries[0]?.raw);
    const options = createParserOptions();

    neutralizePrettierIgnoreForIgnoredComments(text, ast);

    const printer = getEstreePrinter(createPrinters());

    expect(printer.printComment?.(path, options)).toBe(marker);
    expect(mocks.nativePrintComment).not.toHaveBeenCalled();
  });

  it('delegates unmarked comments to the native estree comment printer', () => {
    const nativeDoc = ['native comment'] satisfies Doc;
    const path = createPath({ type: 'CommentBlock', value: 'ordinary' });
    const options = createParserOptions();
    mocks.nativePrintComment.mockReturnValue(nativeDoc);
    const printer = getEstreePrinter(createPrinters());

    expect(printer.printComment?.(path, options)).toBe(nativeDoc);
    expect(mocks.nativePrintComment).toHaveBeenCalledTimes(1);
    expect(mocks.nativePrintComment).toHaveBeenCalledWith(path, options);
  });

  it.each(lineTerminatorCases)('prints a rewritten block comment containing $name as line docs', ({ separator }) => {
    const value = ['first line', 'second line'].join(separator);
    const normalizedValue = ['first line', 'second line'].join('\n');
    const nativeDoc = ['/*', value, '*/'] satisfies Doc;
    const raw = `/*${value}*/`;
    const blockComment = { end: raw.length, start: 0, type: 'Block', value };
    const path = createPath(blockComment);
    const options = createParserOptions();
    mocks.nativePrintComment.mockReturnValue(nativeDoc);

    setJsxBlockCommentRewrites(options, [{ blockCommentIndex: 0, text: raw }]);
    markRewrittenJsxBlockComments(raw, { comments: [blockComment] }, options);

    const printer = getEstreePrinter(createPrinters());

    expect(printer.printComment?.(path, options)).toEqual(replaceEndOfLine(['/*', normalizedValue, '*/'], hardline));
    expect(mocks.nativePrintComment).toHaveBeenCalledTimes(1);
    expect(mocks.nativePrintComment).toHaveBeenCalledWith(path, options);
  });

  it.each(multilineBlockCommentCases)(
    'expands a multiline $type comment containing $name in an empty JSX expression',
    ({ separator, type }) => {
      const expressionDoc = ['printed expression'] satisfies Doc;
      const print = vi.fn(() => expressionDoc);
      const value = ['first line', 'second line'].join(separator);
      const raw = `/*${value}*/`;
      const blockComment = { end: raw.length, start: 0, type, value };
      const node = {
        expression: {
          comments: [{ type: 'Line', value: ['ignored', 'line'].join('\n') }, blockComment],
          type: 'JSXEmptyExpression',
        },
        type: 'JSXExpressionContainer',
      };
      const path = createPath(node);
      const options = createParserOptions();
      const args = { marker: 'args' };

      setJsxBlockCommentRewrites(options, [{ blockCommentIndex: 0, text: raw }]);
      markRewrittenJsxBlockComments(raw, { comments: [blockComment] }, options);

      const printer = getEstreePrinter(createPrinters());

      expect(printer.print(path, options, print, args)).toEqual([
        '{',
        indent([hardline, expressionDoc]),
        hardline,
        '}',
      ]);
      expect(print).toHaveBeenCalledTimes(1);
      expect(print).toHaveBeenCalledWith('expression');
      expect(mocks.nativePrint).not.toHaveBeenCalled();
    },
  );

  it.each(fallbackCases)('delegates $name to the native estree printer', ({ node }) => {
    const nativeDoc = ['native output'] satisfies Doc;
    const print = vi.fn<PrintFunction>();
    const path = createPath(node);
    const options = createParserOptions();
    const args = { marker: 'args' };
    mocks.nativePrint.mockReturnValue(nativeDoc);
    const printer = getEstreePrinter(createPrinters());

    expect(printer.print(path, options, print, args)).toBe(nativeDoc);
    expect(mocks.nativePrint).toHaveBeenCalledTimes(1);
    expect(mocks.nativePrint).toHaveBeenCalledWith(path, options, print, args);
    expect(print).not.toHaveBeenCalled();
  });
});

function createParserOptions(): ParserOptions<AstNode> {
  return { parser: 'babel' } as ParserOptions<AstNode>;
}

function createPath(node: unknown): AstPath<AstNode> {
  return { node } as unknown as AstPath<AstNode>;
}

function getEstreePrinter(printers: ReturnType<typeof createPrinters>): Printer<AstNode> {
  const printer = printers['estree'];

  if (printer === undefined) {
    throw new Error('Expected an estree printer');
  }

  return printer as Printer<AstNode>;
}
