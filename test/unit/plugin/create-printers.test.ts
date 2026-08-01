import type { AstPath, Doc, ParserOptions, Printer } from 'prettier';
import { doc } from 'prettier';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type AstNode = Record<string, unknown>;
type PrintFunction = Parameters<Printer<AstNode>['print']>[2];

const mocks = vi.hoisted(() => {
  const estreePreprocess = vi.fn();
  const nativePrint = vi.fn();
  const estreePrinter = {
    preprocess: estreePreprocess,
    print: nativePrint,
  };
  const jsonPrinter = { print: vi.fn() };

  return {
    estreePreprocess,
    estreePrinter,
    jsonPrinter,
    nativePrint,
  };
});

vi.mock('prettier/plugins/estree', () => ({
  printers: {
    estree: mocks.estreePrinter,
    'estree-json': mocks.jsonPrinter,
  },
}));

import { createPrinters } from '../../../src/plugin/create-printers.js';

const { hardline, indent } = doc.builders;
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
] as const;

describe('createPrinters', () => {
  beforeEach(() => {
    mocks.nativePrint.mockReset();
  });

  it('preserves the other native printers and estree hooks', () => {
    const printers = createPrinters();
    const estreePrinter = getEstreePrinter(printers);

    expect(printers?.['estree-json']).toBe(mocks.jsonPrinter);
    expect(estreePrinter).not.toBe(mocks.estreePrinter);
    expect(estreePrinter.preprocess).toBe(mocks.estreePreprocess);
    expect(estreePrinter.print).not.toBe(mocks.nativePrint);
  });

  it.each(['Block', 'CommentBlock'] as const)('expands a multiline %s comment in an empty JSX expression', (type) => {
    const expressionDoc = ['printed expression'] satisfies Doc;
    const print = vi.fn(() => expressionDoc);
    const node = {
      expression: {
        comments: [
          { type: 'Line', value: ['ignored', 'line'].join('\n') },
          { type, value: ['first line', 'second line'].join('\n') },
        ],
        type: 'JSXEmptyExpression',
      },
      type: 'JSXExpressionContainer',
    };
    const path = createPath(node);
    const options = createParserOptions();
    const args = { marker: 'args' };
    const printer = getEstreePrinter(createPrinters());

    expect(printer.print(path, options, print, args)).toEqual(['{', indent([hardline, expressionDoc]), hardline, '}']);
    expect(print).toHaveBeenCalledTimes(1);
    expect(print).toHaveBeenCalledWith('expression');
    expect(mocks.nativePrint).not.toHaveBeenCalled();
  });

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
  const printer = printers?.['estree'];

  if (printer === undefined) {
    throw new Error('Expected an estree printer');
  }

  return printer as Printer<AstNode>;
}
