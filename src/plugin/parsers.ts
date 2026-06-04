import type { Parser, Plugin } from 'prettier';
import * as babelPlugin from 'prettier/plugins/babel';
import * as typescriptPlugin from 'prettier/plugins/typescript';

import { wrapComments } from '../comments/wrap.js';

const parserNames = ['babel', 'babel-ts', 'typescript'] as const;

function wrapParser<T>(parser: Parser<T>): Parser<T> {
  return {
    ...parser,
    async preprocess(text, options) {
      const preprocessed = parser.preprocess === undefined ? text : await parser.preprocess(text, options);

      let ast: T;

      try {
        ast = await parser.parse(preprocessed, options);
      } catch {
        return preprocessed;
      }

      return wrapComments(preprocessed, ast, options);
    },
  };
}

export function buildParsers(): Plugin['parsers'] {
  const parsers: Plugin['parsers'] = {};

  for (const parserName of parserNames) {
    const sourceParsers = parserName === 'typescript' ? typescriptPlugin.parsers : babelPlugin.parsers;
    const parser = (sourceParsers as Record<string, Parser<unknown> | undefined>)[parserName];

    if (parser !== undefined) {
      parsers[parserName] = wrapParser(parser);
    }
  }

  return parsers;
}
