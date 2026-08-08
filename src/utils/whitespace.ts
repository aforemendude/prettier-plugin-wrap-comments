const ECMASCRIPT_HORIZONTAL_WHITESPACE_PATTERN =
  /^[\t\u000b\u000c \u00a0\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff]$/u;

export function isEcmaScriptHorizontalWhitespace(character: string): boolean {
  return ECMASCRIPT_HORIZONTAL_WHITESPACE_PATTERN.test(character);
}

export function skipWhitespace(text: string, index: number): number {
  let cursor = index;

  while (cursor < text.length) {
    const character = text[cursor];

    if (character === undefined || !/\s/u.test(character)) {
      break;
    }

    cursor += 1;
  }

  return cursor;
}

export function trimWhitespaceEnd(text: string, start: number, end: number): number {
  let cursor = end;

  while (cursor > start) {
    const character = text[cursor - 1];

    if (character === undefined || !/\s/u.test(character)) {
      break;
    }

    cursor -= 1;
  }

  return cursor;
}
