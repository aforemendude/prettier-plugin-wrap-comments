import { format } from 'prettier';

import { isBlankLine } from './source-lines.js';
import { getTabWidth } from './wrap-options.js';
import type { WrapOptions } from './wrap-options.js';

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

function trimBlankEdges(markdown: string): string {
  const lines = markdown.split('\n');

  while (isBlankLine(lines[0])) {
    lines.shift();
  }

  while (isBlankLine(lines.at(-1))) {
    lines.pop();
  }

  return lines.join('\n');
}
