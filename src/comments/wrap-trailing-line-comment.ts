import { normalizeLineCommentBody } from './comment-body.js';
import type { CommentRange } from './comment-ranges.js';
import { getColumns } from '../utils/display-width.js';
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
  const indent = getTrailingCommentIndent(codeText, linePrefix, options, outputLayout?.lineIndentColumn);
  const availableWidth = getAvailableContentWidth(options, getColumns(indent, tabWidth) + 3);
  const formattedLines = await formatMarkdownLines(body, availableWidth, options);
  const newline = getPreferredNewline(text, options);
  const leadingCommentText = formattedLines
    .map((line) => `${indent}${line.length === 0 ? '//' : `// ${line}`}`)
    .join(newline);
  const codeEnd = lineStart + codeText.length;

  return [
    {
      end: lineStart,
      start: lineStart,
      text: [leadingCommentText, ''].join(newline),
    },
    {
      end: lineEnd,
      start: codeEnd,
      text: '',
    },
  ];
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
