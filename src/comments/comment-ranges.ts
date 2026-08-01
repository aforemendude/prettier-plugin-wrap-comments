import { numberOrUndefined } from '../utils/type-guards.js';

type AstWithComments = {
  comments?: unknown;
  program?: {
    comments?: unknown;
  };
};

export type RawComment = {
  end?: unknown;
  loc?: {
    start?: {
      column?: unknown;
    };
  };
  range?: unknown;
  start?: unknown;
  type?: unknown;
  value?: unknown;
};

export type CommentRange = {
  end: number;
  kind: 'block' | 'line';
  start: number;
};

export type CommentEntry = {
  range: CommentRange;
  raw: RawComment;
};

export function collectAstComments(ast: unknown): RawComment[] {
  const candidate = ast as AstWithComments;

  if (Array.isArray(candidate.comments)) {
    return candidate.comments as RawComment[];
  }

  if (Array.isArray(candidate.program?.comments)) {
    return candidate.program.comments as RawComment[];
  }

  return [];
}

export function collectCommentEntries(ast: unknown, text: string): CommentEntry[] {
  return collectAstComments(ast)
    .map((raw) => ({ range: toCommentRange(raw, text), raw }))
    .filter((entry): entry is CommentEntry => entry.range !== undefined)
    .sort((left, right) => left.range.start - right.range.start);
}

export function toCommentRange(comment: RawComment, text: string): CommentRange | undefined {
  const range = Array.isArray(comment.range) ? comment.range : undefined;
  const start = numberOrUndefined(comment.start) ?? numberOrUndefined(range?.[0]);
  const end = numberOrUndefined(comment.end) ?? numberOrUndefined(range?.[1]);

  if (start === undefined || end === undefined || start >= end) {
    return undefined;
  }

  const rawStart = text.slice(start, start + 3);

  if (rawStart.startsWith('//')) {
    return { end, kind: 'line', start };
  }

  if (rawStart.startsWith('/*')) {
    return { end, kind: 'block', start };
  }

  return undefined;
}
