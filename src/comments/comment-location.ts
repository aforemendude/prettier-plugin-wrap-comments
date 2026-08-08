import type { CommentRange } from './comment-ranges.js';
import { getLineEnd, getLinePrefix, getLineStart } from '../utils/source-lines.js';
import { isEcmaScriptHorizontalWhitespace } from '../utils/whitespace.js';

export function isStandaloneComment(text: string, comment: CommentRange): boolean {
  return comment.kind === 'line' ? isStandaloneLineComment(text, comment) : isStandaloneBlockComment(text, comment);
}

export function isStandaloneLineComment(text: string, comment: CommentRange): boolean {
  return isOnlyHorizontalWhitespace(getLinePrefix(text, comment.start));
}

export function isStandaloneBlockComment(text: string, comment: { end: number; start: number }): boolean {
  const before = text.slice(getLineStart(text, comment.start), comment.start);
  const after = text.slice(comment.end, getLineEnd(text, comment.end));

  return isOnlyHorizontalWhitespace(before) && isOnlyHorizontalWhitespace(after);
}

export function areCommentsOnAdjacentLines(
  text: string,
  previousComment: CommentRange,
  comment: CommentRange,
): boolean {
  return isOnlyNewlineAndIndent(text.slice(previousComment.end, comment.start));
}

export function isCommentAdjacentBeforeIndex(text: string, comment: CommentRange, index: number): boolean {
  return isOnlyNewlineAndIndent(text.slice(comment.end, index));
}

function isOnlyNewlineAndIndent(text: string): boolean {
  const newline = /^(?:\r\n|[\n\r\u2028\u2029])/u.exec(text)?.[0];

  return newline !== undefined && isOnlyHorizontalWhitespace(text.slice(newline.length));
}

function isOnlyHorizontalWhitespace(text: string): boolean {
  for (const character of text) {
    if (!isEcmaScriptHorizontalWhitespace(character)) {
      return false;
    }
  }

  return true;
}
