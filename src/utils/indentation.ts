import { getLinePrefix } from './source-lines.js';
import { getTabWidth } from './wrap-options.js';
import type { WrapOptions } from './wrap-options.js';

export function getContinuationIndent(
  text: string,
  commentStart: number,
  markerColumn: number,
  options: WrapOptions,
): string {
  const linePrefix = getLinePrefix(text, commentStart);

  if (/^[ \t]*$/u.test(linePrefix)) {
    return linePrefix;
  }

  return makeIndent(markerColumn, options);
}

export function getLeadingIndent(text: string): string {
  return /^[ \t]*/u.exec(text)?.[0] ?? '';
}

export function makeIndent(column: number, options: WrapOptions): string {
  const tabWidth = getTabWidth(options);

  if (options.useTabs === true) {
    const tabs = Math.floor(column / tabWidth);
    const spaces = column % tabWidth;

    return `${'\t'.repeat(tabs)}${' '.repeat(spaces)}`;
  }

  return ' '.repeat(column);
}
