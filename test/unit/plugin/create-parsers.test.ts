import type { Parser, ParserOptions } from 'prettier';
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
    wrapCommentsWithMetadata: vi.fn(),
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
  wrapCommentsWithMetadata: mocks.wrapCommentsWithMetadata,
}));

vi.mock('../../../src/plugin/get-printer-layout-source.js', () => ({
  getPrinterLayoutSource: mocks.getPrinterLayoutSource,
}));

import { createParsers } from '../../../src/plugin/create-parsers.js';
import { isRewrittenJsxBlockComment } from '../../../src/plugin/jsx-comment-rewrite-metadata.js';

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
    mocks.wrapCommentsWithMetadata.mockReset();
  });

  it('wraps every available supported parser while preserving its metadata', () => {
    const parsers = createParsers();

    expect(Object.keys(parsers)).toEqual(['babel', 'babel-ts', 'typescript']);

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

    expect(Object.keys(createParsers())).toEqual(['babel', 'typescript']);
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

  it('delegates final parsing to the nearest preceding matching plugin without exposing later plugins', async () => {
    const source = 'const value = true;';
    const options = createParserOptions('babel');
    const precedingAst = { source: 'preceding parser' };
    const neutralizedAst = { source: 'neutralized preceding parser' };
    let delegatedPlugins: ParserOptions['plugins'] | undefined;
    const precedingParse = vi.fn<Parser<unknown>['parse']>().mockImplementation((_text, delegatedOptions) => {
      delegatedPlugins = delegatedOptions.plugins;

      return precedingAst;
    });
    const followingParse = vi.fn<Parser<unknown>['parse']>().mockResolvedValue({ source: 'following parser' });
    const precedingParser: Parser<unknown> = { ...mocks.babelParser, parse: precedingParse };
    const followingParser: Parser<unknown> = { ...mocks.babelParser, parse: followingParse };
    const parsers = createParsers();
    const parser = getParser(parsers, 'babel');
    const precedingPlugin = { name: 'preceding', parsers: { babel: precedingParser } };
    const wrappedPlugin = {
      name: '@aforemendude/prettier-plugin-wrap-comments',
      parsers,
    };
    const followingPlugin = { name: 'following', parsers: { babel: followingParser } };

    options.plugins = [precedingPlugin, wrappedPlugin, followingPlugin];
    mocks.neutralizePrettierIgnoreForIgnoredComments.mockReturnValue(neutralizedAst);

    await expect(parser.parse(source, options)).resolves.toBe(neutralizedAst);
    expect(precedingParse).toHaveBeenCalledTimes(1);
    expect(precedingParse.mock.calls[0]?.[0]).toBe(source);
    expect(precedingParse.mock.calls[0]?.[1]).toBe(options);
    expect(delegatedPlugins).toEqual([precedingPlugin]);
    expect(options.plugins).toEqual([precedingPlugin, wrappedPlugin, followingPlugin]);
    expect(followingParse).not.toHaveBeenCalled();
    expect(mocks.babelParser.parse).not.toHaveBeenCalled();
  });

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
    const source = ['// original comment', 'const value = true;'].join('\n');
    const preprocessedSource = ['// preprocessed comment', 'const value = false;'].join('\n');
    const wrappedSource = '// wrapped';
    const options = createParserOptions('babel');
    const ast = { comments: [{}] };
    const printerLayoutSource = { ast: { formatted: true }, text: 'formatted source' };
    const jsxBlockCommentRewrites = [{ blockCommentIndex: 0, text: '/* wrapped */' }];
    const preprocess = vi.fn().mockResolvedValue(preprocessedSource);
    mocks.babelParser.preprocess = preprocess;
    mocks.babelParser.parse.mockResolvedValue(ast);
    mocks.collectAstComments.mockReturnValue(ast.comments);
    mocks.getPrinterLayoutSource.mockResolvedValue(printerLayoutSource);
    mocks.wrapCommentsWithMetadata.mockResolvedValue({ jsxBlockCommentRewrites, text: wrappedSource });
    const parser = getParser(createParsers(), 'babel');

    await expect(callPreprocess(parser, source, options)).resolves.toBe(wrappedSource);
    expect(preprocess).toHaveBeenCalledTimes(1);
    expect(preprocess).toHaveBeenCalledWith(source, options);
    expect(mocks.babelParser.parse).toHaveBeenCalledTimes(1);
    expect(mocks.babelParser.parse.mock.calls[0]?.[0]).toBe(preprocessedSource);
    expect(mocks.babelParser.parse.mock.calls[0]?.[1]).toMatchObject({ parser: 'babel' });
    expect(mocks.babelParser.parse.mock.calls[0]?.[1]).not.toBe(options);
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
    expect(mocks.wrapCommentsWithMetadata).toHaveBeenCalledTimes(1);
    expect(mocks.wrapCommentsWithMetadata).toHaveBeenCalledWith(preprocessedSource, ast, options, printerLayoutSource);
  });

  it('delegates preprocessing and analysis to the nearest preceding matching plugin', async () => {
    const source = ['// original comment', 'const value = true;'].join('\n');
    const preprocessedSource = ['// preceding comment', 'const value = false;'].join('\n');
    const wrappedSource = '// wrapped';
    const options = createParserOptions('typescript');
    const ast = { comments: [{}] };
    const printerLayoutSource = { ast: { formatted: true }, text: 'formatted source' };
    let analysisPlugins: ParserOptions['plugins'] | undefined;
    let preprocessPlugins: ParserOptions['plugins'] | undefined;
    const preprocess = vi
      .fn<NonNullable<Parser<unknown>['preprocess']>>()
      .mockImplementation((_text, delegateOptions) => {
        delegateOptions['normalizedByPrecedingPlugin'] = true;
        preprocessPlugins = delegateOptions.plugins;

        return preprocessedSource;
      });
    const parse = vi.fn<Parser<unknown>['parse']>().mockImplementation((_text, delegateOptions) => {
      analysisPlugins = delegateOptions.plugins;

      return ast;
    });
    const precedingParser: Parser<unknown> = { ...mocks.typescriptParser, parse, preprocess };
    const parsers = createParsers();
    const parser = getParser(parsers, 'typescript');
    const precedingPlugin = { name: 'preceding', parsers: { typescript: precedingParser } };
    const wrappedPlugin = {
      name: '@aforemendude/prettier-plugin-wrap-comments',
      parsers,
    };

    options.plugins = [precedingPlugin, wrappedPlugin];
    mocks.collectAstComments.mockReturnValue(ast.comments);
    mocks.getPrinterLayoutSource.mockResolvedValue(printerLayoutSource);
    mocks.wrapCommentsWithMetadata.mockResolvedValue({ jsxBlockCommentRewrites: [], text: wrappedSource });

    await expect(callPreprocess(parser, source, options)).resolves.toBe(wrappedSource);
    expect(preprocess).toHaveBeenCalledTimes(1);
    expect(preprocess.mock.calls[0]?.[0]).toBe(source);
    expect(preprocess.mock.calls[0]?.[1]).toBe(options);
    expect(preprocessPlugins).toEqual([precedingPlugin]);
    expect(options['normalizedByPrecedingPlugin']).toBe(true);
    expect(options.plugins).toEqual([precedingPlugin, wrappedPlugin]);
    expect(parse).toHaveBeenCalledTimes(1);
    expect(parse.mock.calls[0]?.[0]).toBe(preprocessedSource);
    expect(parse.mock.calls[0]?.[1]).not.toBe(options);
    expect(analysisPlugins).toEqual([precedingPlugin]);
    expect(mocks.typescriptParser.parse).not.toHaveBeenCalled();
    expect(mocks.getPrinterLayoutSource).toHaveBeenCalledWith(
      preprocessedSource,
      ast,
      'typescript',
      precedingParser,
      expect.objectContaining({ plugins: [precedingPlugin] }),
    );
    expect(mocks.wrapCommentsWithMetadata).toHaveBeenCalledWith(preprocessedSource, ast, options, printerLayoutSource);
  });

  it('marks rewritten JSX block comments on the final parsed AST', async () => {
    const originalSource = '<span>{/* original */}</span>';
    const rewrittenComment = ['/*', ' * rewritten', ' */'].join('\n');
    const rewrittenSource = `<span>{${rewrittenComment}}</span>`;
    const options = createParserOptions('babel');
    const originalAst = { comments: [{}] };
    const rewrittenCommentStart = rewrittenSource.indexOf('/*');
    const finalComment = {
      end: rewrittenCommentStart + rewrittenComment.length,
      start: rewrittenCommentStart,
      type: 'Block',
      value: rewrittenComment.slice(2, -2),
    };
    const finalAst = { comments: [finalComment] };
    mocks.babelParser.parse.mockResolvedValueOnce(originalAst).mockResolvedValueOnce(finalAst);
    mocks.collectAstComments.mockReturnValueOnce(originalAst.comments).mockReturnValueOnce(finalAst.comments);
    mocks.getPrinterLayoutSource.mockResolvedValue(undefined);
    mocks.wrapCommentsWithMetadata.mockResolvedValue({
      jsxBlockCommentRewrites: [{ blockCommentIndex: 0, text: rewrittenComment }],
      text: rewrittenSource,
    });
    mocks.neutralizePrettierIgnoreForIgnoredComments.mockReturnValue(finalAst);
    const parser = getParser(createParsers(), 'babel');

    await expect(callPreprocess(parser, originalSource, options)).resolves.toBe(rewrittenSource);
    await expect(parser.parse(rewrittenSource, options)).resolves.toBe(finalAst);

    expect(isRewrittenJsxBlockComment(finalComment)).toBe(true);
  });

  it('isolates speculative parser option mutations from the real Babel parse', async () => {
    const source = ['// @flow', 'const value: number = 1;'].join('\n');
    const options = createParserOptions('babel');
    const analysisAst = { comments: [] };
    const finalAst = { comments: [] };
    mocks.babelParser.parse
      .mockImplementationOnce((_source, analysisOptions) => {
        expect(analysisOptions.parser).toBe('babel');
        expect(analysisOptions).not.toBe(options);

        analysisOptions.parser = 'babel-flow';

        return analysisAst;
      })
      .mockResolvedValueOnce(finalAst);
    mocks.collectAstComments.mockReturnValue([]);
    mocks.neutralizePrettierIgnoreForIgnoredComments.mockReturnValue(finalAst);
    const parser = getParser(createParsers(), 'babel');

    await expect(callPreprocess(parser, source, options)).resolves.toBe(source);
    expect(options.parser).toBe('babel');
    expect(mocks.babelParser.parse.mock.calls[0]?.[1]).toEqual({ ...options, parser: 'babel-flow' });
    expect(mocks.babelParser.parse.mock.calls[0]?.[1]).not.toBe(options);

    await expect(parser.parse(source, options)).resolves.toBe(finalAst);
    expect(mocks.babelParser.parse.mock.calls[1]).toEqual([source, options]);
  });

  it.each(parserCases)('skips analysis for comment-free $parserName source', async ({ baseParser, parserName }) => {
    const source = `const ${parserName.replace('-', '')} = true;`;
    const options = createParserOptions(parserName);
    const parser = getParser(createParsers(), parserName);

    await expect(callPreprocess(parser, source, options)).resolves.toBe(source);
    expect(baseParser.parse).not.toHaveBeenCalled();
    expect(mocks.collectAstComments).not.toHaveBeenCalled();
    expect(mocks.getPrinterLayoutSource).not.toHaveBeenCalled();
    expect(mocks.wrapCommentsWithMetadata).not.toHaveBeenCalled();
  });

  it.each(['//', '/*'])('retains AST analysis when preprocessed source contains %s', async (delimiter) => {
    const source = 'const value = true;';
    const preprocessedSource = `const delimiter = '${delimiter}';`;
    const options = createParserOptions('typescript');
    const ast = { comments: [] };
    const preprocess = vi.fn().mockResolvedValue(preprocessedSource);
    mocks.typescriptParser.preprocess = preprocess;
    mocks.typescriptParser.parse.mockResolvedValue(ast);
    mocks.collectAstComments.mockReturnValue([]);
    const parser = getParser(createParsers(), 'typescript');

    await expect(callPreprocess(parser, source, options)).resolves.toBe(preprocessedSource);
    expect(preprocess).toHaveBeenCalledWith(source, options);
    expect(mocks.typescriptParser.parse).toHaveBeenCalledWith(preprocessedSource, {
      ...options,
      parser: 'typescript',
    });
    expect(mocks.typescriptParser.parse.mock.calls[0]?.[1]).not.toBe(options);
    expect(mocks.collectAstComments).toHaveBeenCalledWith(ast);
    expect(mocks.getPrinterLayoutSource).not.toHaveBeenCalled();
    expect(mocks.wrapCommentsWithMetadata).not.toHaveBeenCalled();
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
    expect(mocks.wrapCommentsWithMetadata).not.toHaveBeenCalled();
  });

  it('returns preprocessed source unchanged when parsing it fails', async () => {
    const source = 'original source';
    const preprocessedSource = 'invalid /* preprocessed source';
    const options = createParserOptions('babel-ts');
    const preprocess = vi.fn().mockResolvedValue(preprocessedSource);
    mocks.babelTsParser.preprocess = preprocess;
    mocks.babelTsParser.parse.mockRejectedValue(new SyntaxError('invalid preprocessed source'));
    const parser = getParser(createParsers(), 'babel-ts');

    await expect(callPreprocess(parser, source, options)).resolves.toBe(preprocessedSource);
    expect(preprocess).toHaveBeenCalledTimes(1);
    expect(preprocess).toHaveBeenCalledWith(source, options);
    expect(mocks.babelTsParser.parse).toHaveBeenCalledTimes(1);
    expect(mocks.babelTsParser.parse).toHaveBeenCalledWith(preprocessedSource, { ...options, parser: 'babel-ts' });
    expect(mocks.babelTsParser.parse.mock.calls[0]?.[1]).not.toBe(options);
    expect(mocks.collectAstComments).not.toHaveBeenCalled();
    expect(mocks.getPrinterLayoutSource).not.toHaveBeenCalled();
    expect(mocks.wrapCommentsWithMetadata).not.toHaveBeenCalled();
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
    expect(mocks.wrapCommentsWithMetadata).not.toHaveBeenCalled();
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

function getParser(parsers: ReturnType<typeof createParsers>, parserName: string): Parser<unknown> {
  const parser = parsers[parserName];

  if (parser === undefined) {
    throw new Error(`Expected ${parserName} parser`);
  }

  return parser;
}
