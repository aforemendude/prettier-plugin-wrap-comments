import type { WrapOptions } from './wrap-options.js';

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

export function isBlankLine(line: string | undefined): boolean {
  return line !== undefined && line.trim() === '';
}
