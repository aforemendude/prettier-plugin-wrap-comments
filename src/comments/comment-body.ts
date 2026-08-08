import type { CommentRange } from './comment-ranges.js';
import { isBlankLine, normalizeLineTerminators } from '../utils/source-lines.js';

export function getCommentBody(text: string, comment: CommentRange): string {
  const raw = text.slice(comment.start, comment.end);

  return comment.kind === 'line' ? normalizeLineCommentBody(raw.slice(2)) : normalizeBlockCommentBody(raw);
}

export function normalizeLineCommentBody(rawBody: string): string {
  if (rawBody.trim() === '') {
    return '';
  }

  return rawBody.replace(/^[ \t]?/, '').replace(/[ \t]+$/u, '');
}

export function normalizeBlockCommentBody(rawComment: string): string {
  const body = normalizeLineTerminators(rawComment.slice(2, -2));
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
