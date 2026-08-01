import { format } from 'prettier';
import type { Parser, ParserOptions, Plugin } from 'prettier';

import type { PrinterLayoutSource } from '../comments/printer-layout.js';
import { createPrinters } from './create-printers.js';
import type { SupportedParserName } from './parser-names.js';

export async function getPrinterLayoutSource<T>(
  text: string,
  ast: T,
  parserName: SupportedParserName,
  parser: Parser<T>,
  options: ParserOptions,
): Promise<PrinterLayoutSource | undefined> {
  const printerLayoutPlugin: Plugin = {
    parsers: { [parserName]: parser },
    printers: createPrinters(),
  };

  try {
    // Preprocessing runs before the JavaScript printer chooses indentation and line breaks. Probe the native output so
    // comment widths can be measured against those final positions.
    const formattedText = await format(text, {
      ...options,
      endOfLine: 'lf',
      parser: parserName,
      plugins: [printerLayoutPlugin],
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
