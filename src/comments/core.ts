import type { AstWithComments, CommentRange, RawComment } from '../shared/types.js';

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
    return lines[0]?.trim() ?? '';
  }

  while (isBlankLine(lines[0])) {
    lines.shift();
  }

  while (isBlankLine(lines.at(-1))) {
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

const PRAGMA_DIRECTIVE_COMMENT_PATTERNS: readonly RegExp[] = [
  /^@(?:license|preserve)\b/u,
  /^@(?:jsxFrag|jsxImportSource|jsxRuntime|jsx)\b/u,
  /^@(?:ts-check|ts-expect-error|ts-ignore|ts-nocheck)\b/u,
  /^[@#]__(?:NO_SIDE_EFFECTS|PURE)__\b/u,
];

const SOURCE_MAP_DIRECTIVE_COMMENT_PATTERNS: readonly RegExp[] = [
  /^[#@][ \t]*sourceMappingURL=/u,
  /^[#@][ \t]*sourceURL=/u,
  /^sourceMappingURL=/u,
  /^sourceURL=/u,
];

const TOOL_DIRECTIVE_COMMENT_PATTERNS: readonly RegExp[] = [
  /^biome-ignore\b/u,
  /^c8\b/u,
  /^deno-lint-ignore\b/u,
  /^eslint\b/u,
  /^eslint-/u,
  /^exported\b/u,
  /^globals?\b/u,
  /^istanbul\b/u,
  /^jshint\b/u,
  /^nyc\b/u,
  /^oxlint\b/u,
  /^prettier-ignore\b/u,
  /^prettier-ignore-start\b/u,
  /^prettier-ignore-end\b/u,
  /^stylelint\b/u,
  /^tslint\b/u,
  /^v8\b/u,
  /^vite-ignore\b/u,
];

const BUNDLER_DIRECTIVE_COMMENT_PATTERNS: readonly RegExp[] = [
  /^webpack(?:ChunkName|Exclude|Ignore|Include|Mode|Prefetch|Preload)\b/u,
];

const DIRECTIVE_COMMENT_PATTERNS: readonly RegExp[] = [
  ...PRAGMA_DIRECTIVE_COMMENT_PATTERNS,
  ...SOURCE_MAP_DIRECTIVE_COMMENT_PATTERNS,
  ...TOOL_DIRECTIVE_COMMENT_PATTERNS,
  ...BUNDLER_DIRECTIVE_COMMENT_PATTERNS,
];

export function isDirectiveComment(body: string): boolean {
  const normalizedBody = body.trimStart();

  return DIRECTIVE_COMMENT_PATTERNS.some((pattern) => pattern.test(normalizedBody));
}

export function hasPreserveCommentMarker(rawComment: string): boolean {
  return rawComment.startsWith('/*!') || rawComment.startsWith('//!');
}

function isBlankLine(line: string | undefined): boolean {
  return line !== undefined && line.trim() === '';
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}
