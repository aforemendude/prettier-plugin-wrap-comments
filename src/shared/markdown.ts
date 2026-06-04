import { format } from 'prettier';

import { getTabWidth } from './options.js';
import { trimBlankEdges } from './text.js';
import type { WrapOptions } from './types.js';

export async function formatMarkdownLines(
  markdown: string,
  printWidth: number,
  options: WrapOptions,
): Promise<string[]> {
  const normalized = trimBlankEdges(markdown.replace(/\r\n?/g, '\n'));

  try {
    const formatted = await format(normalized, {
      endOfLine: 'lf',
      parser: 'markdown',
      printWidth,
      proseWrap: 'always',
      tabWidth: getTabWidth(options),
      useTabs: options.useTabs,
    });

    return formatted.replace(/\n$/, '').split('\n');
  } catch {
    return normalized.split('\n');
  }
}
