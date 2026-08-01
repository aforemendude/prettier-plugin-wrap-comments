import type { CommentEntry, CommentRange, RawComment } from '../../../src/comments/comment-ranges.js';

export function createCommentEntries(text: string, rawComments: string[]): CommentEntry[] {
  const entries: CommentEntry[] = [];
  let searchStart = 0;

  for (const rawComment of rawComments) {
    const range = createCommentRange(text, rawComment, searchStart);
    const raw = createRawComment(text, range);

    entries.push({ range, raw });
    searchStart = range.end;
  }

  return entries;
}

export function createCommentRange(text: string, rawComment: string, searchStart = 0): CommentRange {
  const start = text.indexOf(rawComment, searchStart);

  if (start === -1) {
    throw new Error(`Comment not found: ${rawComment}`);
  }

  if (!rawComment.startsWith('//') && !rawComment.startsWith('/*')) {
    throw new Error(`Unsupported comment syntax: ${rawComment}`);
  }

  return {
    end: start + rawComment.length,
    kind: rawComment.startsWith('//') ? 'line' : 'block',
    start,
  };
}

export function createRawComment(text: string, range: CommentRange): RawComment {
  const rawComment = text.slice(range.start, range.end);
  const isLine = range.kind === 'line';

  return {
    end: range.end,
    start: range.start,
    type: isLine ? 'CommentLine' : 'CommentBlock',
    value: isLine ? rawComment.slice(2) : rawComment.slice(2, -2),
  };
}
