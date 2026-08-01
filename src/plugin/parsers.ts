import { format } from 'prettier';
import type { Parser, ParserOptions, Plugin } from 'prettier';
import * as babelPlugin from 'prettier/plugins/babel';
import * as typescriptPlugin from 'prettier/plugins/typescript';

import { collectComments } from '../comments/core.js';
import { neutralizePrettierIgnoreForIgnoredComments, wrapComments } from '../comments/wrap.js';
import type { PrinterLayoutSource } from '../comments/wrap.js';
import { buildPrinters } from './printers.js';

const parserNames = ['babel', 'babel-ts', 'typescript'] as const;
type ParserName = (typeof parserNames)[number];

function wrapParser<T>(parserName: ParserName, parser: Parser<T>): Parser<T> {
  const printerLayoutPlugin: Plugin = {
    parsers: { [parserName]: parser },
    printers: buildPrinters(),
  };

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

      if (collectComments(ast).length === 0) {
        return preprocessed;
      }

      const printerLayout = await getPrinterLayout(preprocessed, ast, parserName, parser, options, printerLayoutPlugin);

      return wrapComments(preprocessed, ast, options, printerLayout);
    },
  };
}

async function getPrinterLayout<T>(
  text: string,
  ast: T,
  parserName: ParserName,
  parser: Parser<T>,
  options: ParserOptions,
  plugin: Plugin,
): Promise<PrinterLayoutSource | undefined> {
  try {
    // Preprocessing runs before the JavaScript printer chooses indentation and line breaks.
    // Probe the native output so comment widths can be measured against those final positions.
    const formattedText = await format(text, {
      ...options,
      endOfLine: 'lf',
      parser: parserName,
      plugins: [plugin],
    });

    if (formattedText === text) {
      return { ast, text };
    }

    const formattedAst = await parser.parse(formattedText, options);

    return {
      ast: formattedAst,
      text: formattedText,
    };
  } catch {
    return undefined;
  }
}

export function buildParsers(): Plugin['parsers'] {
  const parsers: Plugin['parsers'] = {};

  for (const parserName of parserNames) {
    const sourceParsers = parserName === 'typescript' ? typescriptPlugin.parsers : babelPlugin.parsers;
    const parser = (sourceParsers as Record<string, Parser<unknown> | undefined>)[parserName];

    if (parser !== undefined) {
      parsers[parserName] = wrapParser(parserName, parser);
    }
  }

  return parsers;
}
