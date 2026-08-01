import type { Parser, ParserOptions, Plugin } from 'prettier';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockParser = Parser<unknown> & {
  marker: string;
};

const mocks = vi.hoisted(() => {
  const createParser = (marker: string) => ({
    astFormat: 'estree',
    locEnd: vi.fn(() => 1),
    locStart: vi.fn(() => 0),
    marker,
    parse: vi.fn(),
    preprocess: undefined as Parser<unknown>['preprocess'],
  });
  const babelParser = createParser('babel');
  const babelTsParser = createParser('babel-ts');
  const typescriptParser = createParser('typescript');

  return {
    babelParser,
    babelParsers: {
      babel: babelParser,
      'babel-ts': babelTsParser,
    } as Record<string, MockParser | undefined>,
    babelTsParser,
    collectAstComments: vi.fn(),
    getPrinterLayoutSource: vi.fn(),
    neutralizePrettierIgnoreForIgnoredComments: vi.fn(),
    typescriptParser,
    typescriptParsers: {
      typescript: typescriptParser,
    } as Record<string, MockParser | undefined>,
    wrapComments: vi.fn(),
  };
});

vi.mock('prettier/plugins/babel', () => ({
  parsers: mocks.babelParsers,
}));

vi.mock('prettier/plugins/typescript', () => ({
  parsers: mocks.typescriptParsers,
}));

vi.mock('../../../src/comments/comment-ranges.js', () => ({
  collectAstComments: mocks.collectAstComments,
}));

vi.mock('../../../src/comments/prettier-ignore.js', () => ({
  neutralizePrettierIgnoreForIgnoredComments: mocks.neutralizePrettierIgnoreForIgnoredComments,
}));

vi.mock('../../../src/comments/wrap-comments.js', () => ({
  wrapComments: mocks.wrapComments,
}));

vi.mock('../../../src/plugin/get-printer-layout-source.js', () => ({
  getPrinterLayoutSource: mocks.getPrinterLayoutSource,
}));

import { createParsers } from '../../../src/plugin/create-parsers.js';

const parserCases = [
  { baseParser: mocks.babelParser, parserName: 'babel' },
  { baseParser: mocks.babelTsParser, parserName: 'babel-ts' },
  { baseParser: mocks.typescriptParser, parserName: 'typescript' },
] as const;

describe('createParsers', () => {
  beforeEach(() => {
    mocks.babelParsers['babel'] = mocks.babelParser;
    mocks.babelParsers['babel-ts'] = mocks.babelTsParser;
    mocks.typescriptParsers['typescript'] = mocks.typescriptParser;

    for (const { baseParser } of parserCases) {
      baseParser.parse.mockReset();
      baseParser.preprocess = undefined;
    }

    mocks.collectAstComments.mockReset();
    mocks.getPrinterLayoutSource.mockReset();
    mocks.neutralizePrettierIgnoreForIgnoredComments.mockReset();
    mocks.wrapComments.mockReset();
  });

  it('wraps every available supported parser while preserving its metadata', () => {
    const parsers = createParsers();

    expect(Object.keys(parsers ?? {})).toEqual(['babel', 'babel-ts', 'typescript']);

    for (const { baseParser, parserName } of parserCases) {
      const parser = getParser(parsers, parserName);

      expect(parser.astFormat).toBe(baseParser.astFormat);
      expect(parser.locStart).toBe(baseParser.locStart);
      expect(parser.locEnd).toBe(baseParser.locEnd);
      expect(parser.parse).not.toBe(baseParser.parse);
      expect(parser.preprocess).toBeTypeOf('function');
    }
  });

  it('omits a supported parser that its source plugin does not provide', () => {
    delete mocks.babelParsers['babel-ts'];

    expect(Object.keys(createParsers() ?? {})).toEqual(['babel', 'typescript']);
  });

  it.each(parserCases)(
    'delegates $parserName parsing and returns the neutralized AST',
    async ({ baseParser, parserName }) => {
      const source = `const ${parserName.replace('-', '')} = true;`;
      const options = createParserOptions(parserName);
      const ast = { parserName };
      const neutralizedAst = { neutralized: parserName };
      baseParser.parse.mockResolvedValue(ast);
      mocks.neutralizePrettierIgnoreForIgnoredComments.mockReturnValue(neutralizedAst);
      const parser = getParser(createParsers(), parserName);

      await expect(parser.parse(source, options)).resolves.toBe(neutralizedAst);
      expect(baseParser.parse).toHaveBeenCalledTimes(1);
      expect(baseParser.parse).toHaveBeenCalledWith(source, options);
      expect(mocks.neutralizePrettierIgnoreForIgnoredComments).toHaveBeenCalledTimes(1);
      expect(mocks.neutralizePrettierIgnoreForIgnoredComments).toHaveBeenCalledWith(source, ast);
    },
  );

  it('propagates parser failures without attempting to neutralize comments', async () => {
    const source = 'invalid source';
    const options = createParserOptions('babel');
    const parseError = new SyntaxError('invalid source');
    mocks.babelParser.parse.mockRejectedValue(parseError);
    const parser = getParser(createParsers(), 'babel');

    await expect(parser.parse(source, options)).rejects.toBe(parseError);
    expect(mocks.neutralizePrettierIgnoreForIgnoredComments).not.toHaveBeenCalled();
  });

  it('preprocesses, probes, and wraps source that has AST comments', async () => {
    const source = 'const value = true;';
    const preprocessedSource = 'const value = false;';
    const wrappedSource = '// wrapped';
    const options = createParserOptions('babel');
    const ast = { comments: [{}] };
    const printerLayoutSource = { ast: { formatted: true }, text: 'formatted source' };
    const preprocess = vi.fn().mockResolvedValue(preprocessedSource);
    mocks.babelParser.preprocess = preprocess;
    mocks.babelParser.parse.mockResolvedValue(ast);
    mocks.collectAstComments.mockReturnValue(ast.comments);
    mocks.getPrinterLayoutSource.mockResolvedValue(printerLayoutSource);
    mocks.wrapComments.mockResolvedValue(wrappedSource);
    const parser = getParser(createParsers(), 'babel');

    await expect(callPreprocess(parser, source, options)).resolves.toBe(wrappedSource);
    expect(preprocess).toHaveBeenCalledTimes(1);
    expect(preprocess).toHaveBeenCalledWith(source, options);
    expect(mocks.babelParser.parse).toHaveBeenCalledTimes(1);
    expect(mocks.babelParser.parse).toHaveBeenCalledWith(preprocessedSource, options);
    expect(mocks.collectAstComments).toHaveBeenCalledTimes(1);
    expect(mocks.collectAstComments).toHaveBeenCalledWith(ast);
    expect(mocks.getPrinterLayoutSource).toHaveBeenCalledTimes(1);
    expect(mocks.getPrinterLayoutSource).toHaveBeenCalledWith(
      preprocessedSource,
      ast,
      'babel',
      mocks.babelParser,
      options,
    );
    expect(mocks.wrapComments).toHaveBeenCalledTimes(1);
    expect(mocks.wrapComments).toHaveBeenCalledWith(preprocessedSource, ast, options, printerLayoutSource);
  });

  it('uses the original source when the source parser has no preprocess hook', async () => {
    const source = 'const value = true;';
    const options = createParserOptions('typescript');
    const ast = { comments: [] };
    mocks.typescriptParser.parse.mockResolvedValue(ast);
    mocks.collectAstComments.mockReturnValue([]);
    const parser = getParser(createParsers(), 'typescript');

    await expect(callPreprocess(parser, source, options)).resolves.toBe(source);
    expect(mocks.typescriptParser.parse).toHaveBeenCalledTimes(1);
    expect(mocks.typescriptParser.parse).toHaveBeenCalledWith(source, options);
    expect(mocks.collectAstComments).toHaveBeenCalledTimes(1);
    expect(mocks.collectAstComments).toHaveBeenCalledWith(ast);
    expect(mocks.getPrinterLayoutSource).not.toHaveBeenCalled();
    expect(mocks.wrapComments).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'cursor', options: { cursorOffset: 0, rangeEnd: 19, rangeStart: 0 } },
    { name: 'range start', options: { cursorOffset: -1, rangeEnd: 19, rangeStart: 1 } },
    { name: 'range end', options: { cursorOffset: -1, rangeEnd: 18, rangeStart: 0 } },
  ])('skips plugin preprocessing for an active $name offset', async ({ options: optionOverrides }) => {
    const source = 'const value = true;';
    const preprocessedSource = 'const value = false;';
    const options = { ...createParserOptions('babel'), ...optionOverrides };
    const preprocess = vi.fn().mockResolvedValue(preprocessedSource);
    mocks.babelParser.preprocess = preprocess;
    const parser = getParser(createParsers(), 'babel');

    await expect(callPreprocess(parser, source, options)).resolves.toBe(preprocessedSource);
    expect(preprocess).toHaveBeenCalledTimes(1);
    expect(preprocess).toHaveBeenCalledWith(source, options);
    expect(mocks.babelParser.parse).not.toHaveBeenCalled();
    expect(mocks.collectAstComments).not.toHaveBeenCalled();
    expect(mocks.getPrinterLayoutSource).not.toHaveBeenCalled();
    expect(mocks.wrapComments).not.toHaveBeenCalled();
  });

  it('returns preprocessed source unchanged when parsing it fails', async () => {
    const source = 'original source';
    const preprocessedSource = 'invalid preprocessed source';
    const options = createParserOptions('babel-ts');
    const preprocess = vi.fn().mockResolvedValue(preprocessedSource);
    mocks.babelTsParser.preprocess = preprocess;
    mocks.babelTsParser.parse.mockRejectedValue(new SyntaxError('invalid preprocessed source'));
    const parser = getParser(createParsers(), 'babel-ts');

    await expect(callPreprocess(parser, source, options)).resolves.toBe(preprocessedSource);
    expect(preprocess).toHaveBeenCalledTimes(1);
    expect(preprocess).toHaveBeenCalledWith(source, options);
    expect(mocks.babelTsParser.parse).toHaveBeenCalledTimes(1);
    expect(mocks.babelTsParser.parse).toHaveBeenCalledWith(preprocessedSource, options);
    expect(mocks.collectAstComments).not.toHaveBeenCalled();
    expect(mocks.getPrinterLayoutSource).not.toHaveBeenCalled();
    expect(mocks.wrapComments).not.toHaveBeenCalled();
  });

  it('propagates source preprocessor failures without attempting to parse', async () => {
    const source = 'original source';
    const options = createParserOptions('babel');
    const preprocessError = new Error('preprocess failed');
    const preprocess = vi.fn().mockRejectedValue(preprocessError);
    mocks.babelParser.preprocess = preprocess;
    const parser = getParser(createParsers(), 'babel');

    await expect(callPreprocess(parser, source, options)).rejects.toBe(preprocessError);
    expect(mocks.babelParser.parse).not.toHaveBeenCalled();
    expect(mocks.collectAstComments).not.toHaveBeenCalled();
    expect(mocks.getPrinterLayoutSource).not.toHaveBeenCalled();
    expect(mocks.wrapComments).not.toHaveBeenCalled();
  });
});

function callPreprocess(parser: Parser<unknown>, source: string, options: ParserOptions): string | Promise<string> {
  if (parser.preprocess === undefined) {
    throw new Error('Expected a wrapped parser to provide a preprocess hook');
  }

  return parser.preprocess(source, options);
}

function createParserOptions(parserName: string): ParserOptions {
  return { parser: parserName } as ParserOptions;
}

function getParser(parsers: Plugin['parsers'], parserName: string): Parser<unknown> {
  const parser = parsers?.[parserName];

  if (parser === undefined) {
    throw new Error(`Expected ${parserName} parser`);
  }

  return parser;
}
