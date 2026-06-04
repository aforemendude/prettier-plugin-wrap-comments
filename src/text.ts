import { getTabWidth } from './options.js';
import type { Replacement, WrapOptions } from './types.js';

export function applyReplacements(text: string, replacements: Replacement[]): string {
  let result = text;

  for (const replacement of [...replacements].sort((left, right) => right.start - left.start)) {
    result = result.slice(0, replacement.start) + replacement.text + result.slice(replacement.end);
  }

  return result;
}

export function getPreferredNewline(text: string, options: WrapOptions): string {
  if (options.endOfLine === 'crlf') {
    return '\r\n';
  }

  if (options.endOfLine === 'cr') {
    return '\r';
  }

  if (options.endOfLine === 'auto') {
    const match = /\r\n|\n|\r/u.exec(text);

    return match?.[0] ?? '\n';
  }

  return '\n';
}

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

export function getLinePrefix(text: string, index: number): string {
  return text.slice(getLineStart(text, index), index);
}

export function getLineStart(text: string, index: number): number {
  const newlineIndex = text.lastIndexOf('\n', index - 1);

  return newlineIndex === -1 ? 0 : newlineIndex + 1;
}

export function getLineEnd(text: string, index: number): number {
  const newlineIndex = text.indexOf('\n', index);

  if (newlineIndex === -1) {
    return text.length;
  }

  return text[newlineIndex - 1] === '\r' ? newlineIndex - 1 : newlineIndex;
}

export function getColumnAt(text: string, index: number, tabWidth: number): number {
  return getColumns(text.slice(getLineStart(text, index), index), tabWidth);
}

export function getColumns(text: string, tabWidth: number): number {
  let column = 0;

  for (const character of text) {
    if (character === '\t') {
      column += tabWidth - (column % tabWidth);
    } else {
      column += 1;
    }
  }

  return column;
}

export function isStandaloneBlockComment(text: string, comment: { end: number; start: number }): boolean {
  const before = text.slice(getLineStart(text, comment.start), comment.start);
  const after = text.slice(comment.end, getLineEnd(text, comment.end));

  return /^[ \t]*$/u.test(before) && /^[ \t]*$/u.test(after);
}

export function trimBlankEdges(markdown: string): string {
  const lines = markdown.split('\n');

  while (lines.length > 0 && lines[0].trim() === '') {
    lines.shift();
  }

  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }

  return lines.join('\n');
}

function makeIndent(column: number, options: WrapOptions): string {
  const tabWidth = getTabWidth(options);

  if (options.useTabs === true) {
    const tabs = Math.floor(column / tabWidth);
    const spaces = column % tabWidth;

    return `${'\t'.repeat(tabs)}${' '.repeat(spaces)}`;
  }

  return ' '.repeat(column);
}
