import type { CommentRange } from './comment-ranges.js';
import { getLineEnd, getLinePrefix, getLineStart } from '../utils/source-lines.js';

export function isStandaloneComment(text: string, comment: CommentRange): boolean {
  return comment.kind === 'line' ? isStandaloneLineComment(text, comment) : isStandaloneBlockComment(text, comment);
}

export function isStandaloneLineComment(text: string, comment: CommentRange): boolean {
  return /^[ \t]*$/u.test(getLinePrefix(text, comment.start));
}

export function isStandaloneBlockComment(text: string, comment: { end: number; start: number }): boolean {
  const before = text.slice(getLineStart(text, comment.start), comment.start);
  const after = text.slice(comment.end, getLineEnd(text, comment.end));

  return /^[ \t]*$/u.test(before) && /^[ \t]*$/u.test(after);
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
  return /^(?:\r\n|\n|\r)[ \t]*$/u.test(text);
}
