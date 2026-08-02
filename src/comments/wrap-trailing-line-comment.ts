import { normalizeLineCommentBody } from './comment-body.js';
import type { CommentRange } from './comment-ranges.js';
import type { EmbeddedTrailingLineCommentMove } from './embedded-expression-ranges.js';
import { getColumnAt, getColumns } from '../utils/display-width.js';
import { formatMarkdownLines } from '../utils/format-markdown.js';
import { getLeadingIndent, makeIndent } from '../utils/indentation.js';
import type { Replacement } from '../utils/replacements.js';
import { getLineEnd, getLineStart, getPreferredNewline } from '../utils/source-lines.js';
import { getAvailableContentWidth, getPrintWidth, getTabWidth } from '../utils/wrap-options.js';
import type { WrapOptions } from '../utils/wrap-options.js';

export type TrailingLineCommentLayout = {
  lineIndentColumn: number;
  lineWidth: number;
};

export async function wrapTrailingLineComment(
  text: string,
  comment: CommentRange,
  options: WrapOptions,
  outputLayout?: TrailingLineCommentLayout,
  move?: EmbeddedTrailingLineCommentMove,
): Promise<Replacement[] | undefined> {
  const lineStart = getLineStart(text, comment.start);
  const lineEnd = getLineEnd(text, comment.start);

  if (comment.end > lineEnd) {
    return undefined;
  }

  if (isTrailingLineCommentWithinPrintWidth(text, lineStart, lineEnd, options, outputLayout?.lineWidth)) {
    return undefined;
  }

  const linePrefix = text.slice(lineStart, comment.start);
  const codeText = linePrefix.replace(/[ \t]+$/u, '');

  if (codeText.trim() === '') {
    return undefined;
  }

  const body = normalizeLineCommentBody(text.slice(comment.start + 2, comment.end));

  if (body.trim() === '') {
    return undefined;
  }

  const tabWidth = getTabWidth(options);
  const markerColumn =
    move === undefined ? undefined : (outputLayout?.lineIndentColumn ?? getColumnAt(text, move.insertAt, tabWidth));
  const indent =
    markerColumn === undefined
      ? getTrailingCommentIndent(codeText, linePrefix, options, outputLayout?.lineIndentColumn)
      : makeIndent(markerColumn, options);
  const availableWidth = getAvailableContentWidth(options, getColumns(indent, tabWidth) + 3);
  const formattedLines = await formatMarkdownLines(body, availableWidth, options);
  const newline = getPreferredNewline(text, options);
  const leadingCommentText = buildLeadingCommentText(formattedLines, indent, newline, move !== undefined);
  const codeEnd = lineStart + codeText.length;
  const insertAt = move?.insertAt ?? lineStart;
  const insertionSuffix = move === undefined ? '' : indent;

  return [
    {
      end: insertAt,
      start: insertAt,
      text: [leadingCommentText, insertionSuffix].join(newline),
    },
    {
      end: lineEnd,
      start: move?.removeStart ?? codeEnd,
      text: '',
    },
  ];
}

function buildLeadingCommentText(
  formattedLines: string[],
  indent: string,
  newline: string,
  startsAtExpression: boolean,
): string {
  return formattedLines
    .map((line, index) => {
      const lineIndent = startsAtExpression && index === 0 ? '' : indent;

      return `${lineIndent}${line.length === 0 ? '//' : `// ${line}`}`;
    })
    .join(newline);
}

function isTrailingLineCommentWithinPrintWidth(
  text: string,
  lineStart: number,
  lineEnd: number,
  options: WrapOptions,
  outputLineWidth?: number,
): boolean {
  if (outputLineWidth !== undefined) {
    return outputLineWidth <= getPrintWidth(options);
  }

  const tabWidth = getTabWidth(options);
  const lineText = text.slice(lineStart, lineEnd).replace(/[ \t]+$/u, '');

  return getColumns(lineText, tabWidth) <= getPrintWidth(options);
}

function getTrailingCommentIndent(
  codeText: string,
  linePrefix: string,
  options: WrapOptions,
  outputLineIndentColumn?: number,
): string {
  const indent = getLeadingIndent(linePrefix);

  if (outputLineIndentColumn === undefined && !isClosingDelimiterLine(codeText)) {
    return indent;
  }

  const tabWidth = getTabWidth(options);
  const indentColumn = outputLineIndentColumn ?? getColumns(indent, tabWidth);
  const commentIndentColumn = isClosingDelimiterLine(codeText) ? indentColumn + tabWidth : indentColumn;

  return makeIndent(commentIndentColumn, options);
}

function isClosingDelimiterLine(codeText: string): boolean {
  return /^[ \t]*[\])}]+[\])};,]*[ \t]*$/u.test(codeText);
}
