import type { Parser, ParserOptions, Plugin } from 'prettier';
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

      // Prettier calculates cursor nodes and initial range boundaries after preprocessing, but those offsets still
      // refer to this input. A range-only request will safely re-enter this hook with the extracted source.
      if (hasOffsetSensitiveFormatting(text, options)) {
        return preprocessed;
      }

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

function hasOffsetSensitiveFormatting(text: string, options: ParserOptions): boolean {
  const cursorOffset = options['cursorOffset'];
  const hasCursor = typeof cursorOffset === 'number' && cursorOffset >= 0;
  const hasPartialRange = options.rangeStart > 0 || options.rangeEnd < text.length;

  return hasCursor || hasPartialRange;
}
