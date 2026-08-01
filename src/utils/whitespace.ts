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
