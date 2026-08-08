import { normalizeBlockCommentBody, normalizeLineCommentBody } from './comment-body.js';
import { isDirectiveComment } from './comment-directives.js';
import type { CommentRange } from './comment-ranges.js';

export function shouldSkipLineComment(text: string, comment: CommentRange): boolean {
  const raw = text.slice(comment.start, comment.end);

  if (raw.startsWith('///') || hasPreserveCommentMarker(raw)) {
    return true;
  }

  return isDirectiveComment(normalizeLineCommentBody(raw.slice(2)));
}

export function shouldSkipBlockComment(text: string, comment: CommentRange): boolean {
  const raw = text.slice(comment.start, comment.end);

  if (raw.startsWith('/**') || hasPreserveCommentMarker(raw) || hasFlowCommentTypeMarker(raw)) {
    return true;
  }

  const body = normalizeBlockCommentBody(raw);

  return body.trim() === '' || isDirectiveComment(body);
}

export function hasPreserveCommentMarker(rawComment: string): boolean {
  return rawComment.startsWith('/*!') || rawComment.startsWith('//!');
}

export function hasFlowCommentTypeMarker(rawComment: string): boolean {
  return /^\/\*[ \t]*(?::|flow-include)/u.test(rawComment);
}
