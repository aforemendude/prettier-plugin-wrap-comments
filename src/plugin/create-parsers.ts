import type { Parser, Plugin } from 'prettier';
import * as babelPlugin from 'prettier/plugins/babel';
import * as typescriptPlugin from 'prettier/plugins/typescript';

import { collectAstComments } from '../comments/comment-ranges.js';
import { neutralizePrettierIgnoreForIgnoredComments } from '../comments/prettier-ignore.js';
import { wrapComments } from '../comments/wrap-comments.js';
import { getPrinterLayoutSource } from './get-printer-layout-source.js';
import { SUPPORTED_PARSER_NAMES } from './parser-names.js';
import type { SupportedParserName } from './parser-names.js';

export function createParsers(): Plugin['parsers'] {
  const parsers: Plugin['parsers'] = {};

  for (const parserName of SUPPORTED_PARSER_NAMES) {
    const sourceParsers = parserName === 'typescript' ? typescriptPlugin.parsers : babelPlugin.parsers;
    const parser = (sourceParsers as Record<string, Parser<unknown> | undefined>)[parserName];

    if (parser !== undefined) {
      parsers[parserName] = createWrappedParser(parserName, parser);
    }
  }

  return parsers;
}

function createWrappedParser<T>(parserName: SupportedParserName, parser: Parser<T>): Parser<T> {
  return {
    ...parser,
    async parse(text, options) {
      const ast = await parser.parse(text, options);

      return neutralizePrettierIgnoreForIgnoredComments(text, ast);
    },
    async preprocess(text, options) {
      const preprocessed = parser.preprocess === undefined ? text : await parser.preprocess(text, options);

      let ast: T;

      try {
        ast = await parser.parse(preprocessed, options);
      } catch {
        return preprocessed;
      }

      if (collectAstComments(ast).length === 0) {
        return preprocessed;
      }

      const printerLayoutSource = await getPrinterLayoutSource(preprocessed, ast, parserName, parser, options);

      return wrapComments(preprocessed, ast, options, printerLayoutSource);
    },
  };
}
