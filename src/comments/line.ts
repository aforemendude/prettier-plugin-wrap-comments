import { hasPreserveCommentMarker, isDirectiveComment, normalizeLineCommentBody } from './core.js';
import { formatMarkdownLines } from '../shared/markdown.js';
import { getAvailableContentWidth, getPrintWidth, getTabWidth } from '../shared/options.js';
import {
  getColumnAt,
  getColumns,
  getContinuationIndent,
  getLineEnd,
  getLinePrefix,
  getLineStart,
  getPreferredNewline,
  makeIndent,
} from '../shared/text.js';
import type { CommentRange, Replacement, WrapOptions } from '../shared/types.js';

export async function wrapLineCommentGroup(
  text: string,
  comments: CommentRange[],
  options: WrapOptions,
): Promise<Replacement | undefined> {
  const firstComment = comments[0];

  if (firstComment === undefined) {
    return undefined;
  }

  const lastComment = comments.at(-1) ?? firstComment;
  const bodyLines = comments.map((comment) => normalizeLineCommentBody(text.slice(comment.start + 2, comment.end)));

  if (bodyLines.every((line) => line.trim() === '')) {
    return undefined;
  }

  const tabWidth = getTabWidth(options);
  const markerColumn = getColumnAt(text, firstComment.start, tabWidth);
  const availableWidth = getAvailableContentWidth(options, markerColumn + 3);
  const formattedLines = await formatMarkdownLines(bodyLines.join('\n'), availableWidth, options);
  const newline = getPreferredNewline(text, options);
  const continuationIndent = getContinuationIndent(text, firstComment.start, markerColumn, options);
  const replacementText = formattedLines
    .map((line, index) => {
      const commentText = line.length === 0 ? '//' : `// ${line}`;

      return index === 0 ? commentText : `${newline}${continuationIndent}${commentText}`;
    })
    .join('');
  const start = firstComment.start;
  const end = lastComment.end;

  if (replacementText === text.slice(start, end)) {
    return undefined;
  }

  return {
    end,
    start,
    text: replacementText,
  };
}

export async function wrapTrailingLineComment(
  text: string,
  comment: CommentRange,
  options: WrapOptions,
): Promise<Replacement[] | undefined> {
  if (isTrailingLineCommentWithinPrintWidth(text, comment, options)) {
    return undefined;
  }

  const lineStart = getLineStart(text, comment.start);
  const lineEnd = getLineEnd(text, comment.end);
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
  const indent = getTrailingCommentIndent(codeText, linePrefix, options);
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
      text: `${leadingCommentText}${newline}`,
    },
    {
      end: lineEnd,
      start: codeEnd,
      text: '',
    },
  ];
}

export function shouldSkipLineComment(text: string, comment: CommentRange): boolean {
  const raw = text.slice(comment.start, comment.end);

  if (raw.startsWith('///') || hasPreserveCommentMarker(raw)) {
    return true;
  }

  return isDirectiveComment(normalizeLineCommentBody(raw.slice(2)));
}

export function isStandaloneLineComment(text: string, comment: CommentRange): boolean {
  return /^[ \t]*$/u.test(getLinePrefix(text, comment.start));
}

export function areAdjacentLineComments(text: string, previous: CommentRange, next: CommentRange): boolean {
  return /^(?:\r\n|\n|\r)[ \t]*$/u.test(text.slice(previous.end, next.start));
}

function isTrailingLineCommentWithinPrintWidth(text: string, comment: CommentRange, options: WrapOptions): boolean {
  const tabWidth = getTabWidth(options);
  const lineStart = getLineStart(text, comment.start);
  const lineEnd = getLineEnd(text, comment.end);
  const lineText = text.slice(lineStart, lineEnd).replace(/[ \t]+$/u, '');

  return getColumns(lineText, tabWidth) <= getPrintWidth(options);
}

function getLineIndent(linePrefix: string): string {
  return /^[ \t]*/u.exec(linePrefix)?.[0] ?? '';
}

function getTrailingCommentIndent(codeText: string, linePrefix: string, options: WrapOptions): string {
  const indent = getLineIndent(linePrefix);

  if (!isClosingDelimiterLine(codeText)) {
    return indent;
  }

  const tabWidth = getTabWidth(options);

  return makeIndent(getColumns(indent, tabWidth) + tabWidth, options);
}

function isClosingDelimiterLine(codeText: string): boolean {
  return /^[ \t]*[\])}]+[\])};,]*[ \t]*$/u.test(codeText);
}
