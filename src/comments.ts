import type { AstWithComments, CommentRange, RawComment } from './types.js';

export function collectComments(ast: unknown): RawComment[] {
  const candidate = ast as AstWithComments;

  if (Array.isArray(candidate.comments)) {
    return candidate.comments as RawComment[];
  }

  if (Array.isArray(candidate.program?.comments)) {
    return candidate.program.comments as RawComment[];
  }

  return [];
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

  if (typeof comment.type === 'string') {
    if (comment.type.includes('Line')) {
      return { end, kind: 'line', start };
    }

    if (comment.type.includes('Block')) {
      return { end, kind: 'block', start };
    }
  }

  return undefined;
}

export function normalizeLineCommentBody(rawBody: string): string {
  if (rawBody.trim() === '') {
    return '';
  }

  return rawBody.replace(/^[ \t]?/, '').replace(/[ \t]+$/u, '');
}

export function normalizeBlockCommentBody(rawComment: string): string {
  const body = rawComment.slice(2, -2).replace(/\r\n?/g, '\n');
  const lines = body.split('\n');

  if (lines.length === 1) {
    return lines[0].trim();
  }

  while (lines.length > 0 && lines[0].trim() === '') {
    lines.shift();
  }

  while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
    lines.pop();
  }

  return lines
    .map((line) => {
      const withoutIndent = line.replace(/^[ \t]*/u, '');

      if (!withoutIndent.startsWith('*')) {
        return withoutIndent.replace(/[ \t]+$/u, '');
      }

      return withoutIndent
        .slice(1)
        .replace(/^[ \t]?/u, '')
        .replace(/[ \t]+$/u, '');
    })
    .join('\n');
}

export function isDirectiveComment(body: string): boolean {
  return /^(?:@(?:__NO_SIDE_EFFECTS__|__PURE__|jsx|jsxImportSource|license|preserve|ts-check|ts-expect-error|ts-ignore|ts-nocheck)\b|#\s*sourceMappingURL=|[@#]__PURE__\b|biome-ignore\b|c8\b|deno-lint-ignore\b|eslint\b|eslint-|exported\b|globals?\b|istanbul\b|jshint\b|nyc\b|oxlint\b|prettier-ignore\b|prettier-ignore-start\b|prettier-ignore-end\b|sourceMappingURL=|stylelint\b|tslint\b|v8\b|vite-ignore\b|webpack(?:ChunkName|Exclude|Ignore|Include|Mode|Prefetch|Preload)\b)/u.test(
    body.trimStart(),
  );
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}
