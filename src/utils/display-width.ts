import { util } from 'prettier';

import { getLineStart } from './source-lines.js';

export function getColumnAt(text: string, index: number, tabWidth: number): number {
  return getColumns(text.slice(getLineStart(text, index), index), tabWidth);
}

export function getColumns(text: string, tabWidth: number, startColumn = 0): number {
  let column = startColumn;
  let segmentStart = 0;

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\t') {
      column += util.getStringWidth(text.slice(segmentStart, index));

      if (tabWidth > 0) {
        column += tabWidth - (column % tabWidth);
      }

      segmentStart = index + 1;
    }
  }

  return column + util.getStringWidth(text.slice(segmentStart)) - startColumn;
}
