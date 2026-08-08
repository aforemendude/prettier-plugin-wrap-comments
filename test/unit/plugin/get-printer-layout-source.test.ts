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
    neutralizePrettierIgnoreForIgnoredComments: vi.fn(),
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

vi.mock('../../../src/comments/prettier-ignore.js', () => ({
  neutralizePrettierIgnoreForIgnoredComments: mocks.neutralizePrettierIgnoreForIgnoredComments,
}));

import { getPrinterLayoutSource } from '../../../src/plugin/get-printer-layout-source.js';

describe('getPrinterLayoutSource', () => {
  beforeEach(() => {
    mocks.createPrinters.mockClear();
    mocks.format.mockReset();
    mocks.neutralizePrettierIgnoreForIgnoredComments.mockReset();
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
    parse.mockImplementation((_source, analysisOptions) => {
      expect(analysisOptions.parser).toBe('babel');
      expect(analysisOptions).not.toBe(options);

      analysisOptions.parser = 'babel-flow';

      return formattedAst;
    });

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
          parsers: {
            babel: {
              ...parser,
              parse: expect.any(Function),
            },
          },
          printers: mocks.printers,
        },
      ],
    });
    expect(parse).toHaveBeenCalledTimes(1);
    expect(parse.mock.calls[0]?.[0]).toBe(formattedSource);
    expect(parse.mock.calls[0]?.[1]).toMatchObject({ parser: 'babel-flow' });
    expect(options.parser).toBe('typescript');
  });

  it('neutralizes a freshly parsed layout AST without mutating the outer AST', async () => {
    const source = ['// prettier-ignore', '// kept', 'const value=1;'].join('\n');
    const ast = { marker: 'outer' };
    const printerLayoutAst = { marker: 'parsed for layout' };
    const neutralizedAst = { marker: 'neutralized for layout' };
    const { parse, parser } = createParser();
    const options = createParserOptions('babel');
    parse.mockResolvedValue(printerLayoutAst);
    mocks.neutralizePrettierIgnoreForIgnoredComments.mockReturnValue(neutralizedAst);
    mocks.format.mockImplementation(async (_source, formatOptions) => {
      const layoutPlugin = formatOptions?.plugins?.[0];

      if (layoutPlugin === undefined || typeof layoutPlugin === 'string') {
        throw new Error('Expected the layout plugin');
      }

      const layoutParser = layoutPlugin.parsers?.['babel'];

      if (layoutParser === undefined) {
        throw new Error('Expected the layout parser');
      }

      expect(layoutParser).not.toBe(parser);
      await expect(layoutParser.parse(source, options)).resolves.toBe(neutralizedAst);

      return source;
    });

    await expect(getPrinterLayoutSource(source, ast, 'babel', parser, options)).resolves.toEqual({ ast, text: source });
    expect(parse).toHaveBeenCalledTimes(1);
    expect(parse).toHaveBeenCalledWith(source, options);
    expect(mocks.neutralizePrettierIgnoreForIgnoredComments).toHaveBeenCalledTimes(1);
    expect(mocks.neutralizePrettierIgnoreForIgnoredComments).toHaveBeenCalledWith(source, printerLayoutAst);
    expect(ast).toEqual({ marker: 'outer' });
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
    expect(parse).toHaveBeenCalledWith(formattedSource, { ...options, parser: 'typescript' });
    expect(parse.mock.calls[0]?.[1]).not.toBe(options);
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
