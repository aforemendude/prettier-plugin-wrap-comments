import type { Parser, ParserOptions } from 'prettier';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type LayoutAst = {
  marker: string;
};

const mocks = vi.hoisted(() => {
  const printers = { estree: { marker: 'printer' } };

  return {
    createPrinters: vi.fn(() => printers),
    format: vi.fn(),
    printers,
  };
});

vi.mock('prettier', async (importOriginal) => {
  const original = await importOriginal<typeof import('prettier')>();

  return {
    ...original,
    format: mocks.format,
  };
});

vi.mock('../../../src/plugin/create-printers.js', () => ({
  createPrinters: mocks.createPrinters,
}));

import { getPrinterLayoutSource } from '../../../src/plugin/get-printer-layout-source.js';

describe('getPrinterLayoutSource', () => {
  beforeEach(() => {
    mocks.createPrinters.mockClear();
    mocks.format.mockReset();
  });

  it('formats with an isolated native-layout plugin and reparses changed output', async () => {
    const source = 'const value=true;';
    const formattedSource = 'const value = true;\n';
    const ast = { marker: 'original' };
    const formattedAst = { marker: 'formatted' };
    const { parse, parser } = createParser();
    const existingPlugin = { parsers: {} };
    const options = {
      endOfLine: 'crlf',
      parser: 'typescript',
      plugins: [existingPlugin],
      printWidth: 72,
    } as ParserOptions<LayoutAst>;
    mocks.format.mockResolvedValue(formattedSource);
    parse.mockResolvedValue(formattedAst);

    await expect(getPrinterLayoutSource(source, ast, 'babel', parser, options)).resolves.toEqual({
      ast: formattedAst,
      text: formattedSource,
    });
    expect(mocks.createPrinters).toHaveBeenCalledTimes(1);
    expect(mocks.format).toHaveBeenCalledTimes(1);
    expect(mocks.format).toHaveBeenCalledWith(source, {
      ...options,
      endOfLine: 'lf',
      parser: 'babel',
      plugins: [
        {
          parsers: { babel: parser },
          printers: mocks.printers,
        },
      ],
    });
    expect(parse).toHaveBeenCalledTimes(1);
    expect(parse).toHaveBeenCalledWith(formattedSource, options);
  });

  it('reuses the original AST when formatting does not change the source', async () => {
    const source = 'const value = true;\n';
    const ast = { marker: 'original' };
    const { parse, parser } = createParser();
    const options = createParserOptions('babel');
    mocks.format.mockResolvedValue(source);

    await expect(getPrinterLayoutSource(source, ast, 'babel', parser, options)).resolves.toEqual({ ast, text: source });
    expect(parse).not.toHaveBeenCalled();
  });

  it('returns undefined when formatting fails without attempting to parse', async () => {
    const source = 'const value = true;';
    const ast = { marker: 'original' };
    const { parse, parser } = createParser();
    const options = createParserOptions('babel-ts');
    mocks.format.mockRejectedValue(new Error('format failed'));

    await expect(getPrinterLayoutSource(source, ast, 'babel-ts', parser, options)).resolves.toBeUndefined();
    expect(parse).not.toHaveBeenCalled();
  });

  it('returns undefined when reparsing formatted output fails', async () => {
    const source = 'const value=true;';
    const formattedSource = 'const value = true;\n';
    const ast = { marker: 'original' };
    const { parse, parser } = createParser();
    const options = createParserOptions('typescript');
    mocks.format.mockResolvedValue(formattedSource);
    parse.mockRejectedValue(new SyntaxError('parse failed'));

    await expect(getPrinterLayoutSource(source, ast, 'typescript', parser, options)).resolves.toBeUndefined();
    expect(parse).toHaveBeenCalledTimes(1);
    expect(parse).toHaveBeenCalledWith(formattedSource, options);
  });
});

function createParser(): { parse: ReturnType<typeof vi.fn<Parser<LayoutAst>['parse']>>; parser: Parser<LayoutAst> } {
  const parse = vi.fn<Parser<LayoutAst>['parse']>();
  const parser: Parser<LayoutAst> = {
    astFormat: 'estree',
    locEnd: () => 1,
    locStart: () => 0,
    parse,
  };

  return { parse, parser };
}

function createParserOptions(parserName: string): ParserOptions<LayoutAst> {
  return { parser: parserName } as ParserOptions<LayoutAst>;
}
