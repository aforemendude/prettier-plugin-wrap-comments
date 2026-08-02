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
  for (let cursor = Math.min(index, text.length) - 1; cursor >= 0; cursor -= 1) {
    const character = text[cursor];

    if (character === '\n' || character === '\u2028' || character === '\u2029') {
      return cursor + 1;
    }

    if (character === '\r' && text[cursor + 1] !== '\n') {
      return cursor + 1;
    }
  }

  return 0;
}

export function getLineEnd(text: string, index: number): number {
  for (let cursor = Math.max(index, 0); cursor < text.length; cursor += 1) {
    const character = text[cursor];

    if (character === '\r' || character === '\n' || character === '\u2028' || character === '\u2029') {
      return character === '\n' && text[cursor - 1] === '\r' ? cursor - 1 : cursor;
    }
  }

  return text.length;
}

export function isBlankLine(line: string | undefined): boolean {
  return line !== undefined && line.trim() === '';
}
