import { wrapBlockComment } from './block.js';
import {
  collectComments,
  hasPreserveCommentMarker,
  isDirectiveComment,
  isPrettierIgnoreComment,
  normalizeBlockCommentBody,
  normalizeLineCommentBody,
  toCommentRange,
} from './core.js';
import {
  areAdjacentLineComments,
  isStandaloneLineComment,
  shouldSkipLineComment,
  wrapLineCommentGroup,
  wrapTrailingLineComment,
} from './line.js';
import { getTabWidth } from '../shared/options.js';
import { applyReplacements, getColumnAt, getLineEnd, getLineStart, isStandaloneBlockComment } from '../shared/text.js';
import type { CommentRange, RawComment, Replacement, WrapOptions } from '../shared/types.js';

const NEUTRALIZED_PRETTIER_IGNORE_COMMENT = 'prettier-ignore wrap-comments';
const AST_TRAVERSAL_SKIP_KEYS = new Set([
  'comments',
  'errors',
  'innerComments',
  'leadingComments',
  'loc',
  'parent',
  'range',
  'tokens',
  'trailingComments',
]);

export async function wrapComments<T>(text: string, ast: T, options: WrapOptions): Promise<string> {
  const commentEntries = collectSortedCommentEntries(ast, text);
  const comments = commentEntries.map((entry) => entry.range);
  const ignoredLineRanges = collectPrettierIgnoredLineRanges(text, ast, commentEntries);

  if (comments.length === 0) {
    return text;
  }

  const replacements: Replacement[] = [];
  const tabWidth = getTabWidth(options);

  for (let index = 0; index < comments.length; index += 1) {
    const comment = comments[index];

    if (comment === undefined) {
      continue;
    }

    if (isCommentInIgnoredLineRange(comment, ignoredLineRanges)) {
      continue;
    }

    if (comment.kind === 'block') {
      if (isPrettierIgnoredBlockComment(text, commentEntries, index)) {
        continue;
      }

      const replacement = await wrapBlockComment(text, comment, options);

      if (replacement !== undefined) {
        replacements.push(replacement);
      }

      continue;
    }

    if (shouldSkipLineComment(text, comment)) {
      continue;
    }

    if (!isStandaloneLineComment(text, comment)) {
      if (isPrettierIgnoredTrailingLineComment(text, commentEntries, index)) {
        continue;
      }

      const replacement = await wrapTrailingLineComment(text, comment, options);

      if (replacement !== undefined) {
        replacements.push(replacement);
      }

      continue;
    }

    const group = [comment];
    let previousComment = comment;

    while (index + 1 < comments.length) {
      const nextComment = comments[index + 1];

      if (nextComment === undefined) {
        break;
      }

      if (
        nextComment.kind !== 'line' ||
        !isStandaloneLineComment(text, nextComment) ||
        shouldSkipLineComment(text, nextComment) ||
        !areAdjacentLineComments(text, previousComment, nextComment) ||
        getColumnAt(text, comment.start, tabWidth) !== getColumnAt(text, nextComment.start, tabWidth)
      ) {
        break;
      }

      group.push(nextComment);
      previousComment = nextComment;
      index += 1;
    }

    const replacement = await wrapLineCommentGroup(text, group, options);

    if (replacement !== undefined) {
      replacements.push(replacement);
    }
  }

  return applyReplacements(text, replacements);
}

export function neutralizePrettierIgnoreForIgnoredBlockComments<T>(text: string, ast: T): T {
  const comments = collectSortedCommentEntries(ast, text);

  for (let index = 0; index < comments.length; index += 1) {
    const entry = comments[index];
    const previousEntry = comments[index - 1];

    if (
      entry !== undefined &&
      previousEntry !== undefined &&
      isPrettierIgnoredBlockComment(text, comments, index) &&
      !isBlockCommentNormallyIgnored(text, entry.range)
    ) {
      previousEntry.raw.value = NEUTRALIZED_PRETTIER_IGNORE_COMMENT;
    }
  }

  return ast;
}

type CommentEntry = {
  range: CommentRange;
  raw: RawComment;
};

type SourceRange = {
  end: number;
  start: number;
};

function collectSortedCommentEntries<T>(ast: T, text: string): CommentEntry[] {
  return collectComments(ast)
    .map((raw) => ({ range: toCommentRange(raw, text), raw }))
    .filter((entry): entry is CommentEntry => entry.range !== undefined)
    .sort((left, right) => left.range.start - right.range.start);
}

function collectPrettierIgnoredLineRanges<T>(text: string, ast: T, comments: CommentEntry[]): SourceRange[] {
  const nodeRanges = collectAstNodeRanges(ast);
  const ignoredLineRanges: SourceRange[] = [];

  for (let index = 0; index < comments.length; index += 1) {
    const comment = comments[index]?.range;

    if (
      comment === undefined ||
      comment.kind !== 'line' ||
      !isStandaloneLineComment(text, comment) ||
      !isPrettierIgnoreComment(getCommentBody(text, comment))
    ) {
      continue;
    }

    const targetStart = getPrettierIgnoreTargetStart(text, comments, index);

    if (targetStart === undefined) {
      continue;
    }

    const targetRange = nodeRanges.find((range) => range.start === targetStart);

    if (targetRange === undefined) {
      continue;
    }

    ignoredLineRanges.push({
      end: getLineEnd(text, targetRange.end),
      start: getLineStart(text, targetRange.start),
    });
  }

  return ignoredLineRanges;
}

function collectAstNodeRanges(ast: unknown): SourceRange[] {
  const ranges: SourceRange[] = [];
  const seen = new Set<object>();

  visit(ast);

  return ranges.sort((left, right) => left.start - right.start || right.end - left.end);

  function visit(value: unknown): void {
    if (!isRecord(value) || seen.has(value)) {
      return;
    }

    seen.add(value);

    const range = getAstNodeRange(value);

    if (range !== undefined && typeof value['type'] === 'string') {
      ranges.push(range);
    }

    for (const [key, child] of Object.entries(value)) {
      if (AST_TRAVERSAL_SKIP_KEYS.has(key)) {
        continue;
      }

      if (Array.isArray(child)) {
        for (const item of child) {
          visit(item);
        }
      } else {
        visit(child);
      }
    }
  }
}

function getAstNodeRange(node: Record<string, unknown>): SourceRange | undefined {
  const start = numberOrUndefined(node['start']) ?? getRangeNumber(node['range'], 0);
  const end = numberOrUndefined(node['end']) ?? getRangeNumber(node['range'], 1);

  if (start === undefined || end === undefined || start >= end) {
    return undefined;
  }

  return { end, start };
}

function getRangeNumber(range: unknown, index: number): number | undefined {
  if (!Array.isArray(range)) {
    return undefined;
  }

  return numberOrUndefined(range[index]);
}

function getPrettierIgnoreTargetStart(
  text: string,
  comments: CommentEntry[],
  ignoreCommentIndex: number,
): number | undefined {
  const ignoreComment = comments[ignoreCommentIndex]?.range;

  if (ignoreComment === undefined) {
    return undefined;
  }

  let cursor = ignoreComment.end;

  for (let index = ignoreCommentIndex + 1; index < comments.length; index += 1) {
    cursor = skipWhitespace(text, cursor);

    const comment = comments[index]?.range;

    if (comment === undefined || comment.start !== cursor) {
      break;
    }

    if (!isStandaloneComment(text, comment) || !isCommentNormallyIgnored(text, comment)) {
      return undefined;
    }

    cursor = comment.end;
  }

  const targetStart = skipWhitespace(text, cursor);

  return targetStart >= text.length ? undefined : targetStart;
}

function skipWhitespace(text: string, index: number): number {
  let cursor = index;

  while (cursor < text.length) {
    const character = text[cursor];

    if (character === undefined || !/\s/u.test(character)) {
      break;
    }

    cursor += 1;
  }

  return cursor;
}

function isCommentInIgnoredLineRange(comment: CommentRange, ignoredLineRanges: SourceRange[]): boolean {
  return ignoredLineRanges.some((range) => comment.start >= range.start && comment.start < range.end);
}

function isPrettierIgnoredBlockComment(text: string, comments: CommentEntry[], index: number): boolean {
  const comment = comments[index]?.range;
  const previousComment = comments[index - 1]?.range;

  if (comment === undefined || comment.kind !== 'block' || previousComment === undefined) {
    return false;
  }

  if (!isStandaloneComment(text, previousComment) || !isAdjacentPreviousComment(text, previousComment, comment)) {
    return false;
  }

  return isPrettierIgnoreComment(getCommentBody(text, previousComment));
}

function isPrettierIgnoredTrailingLineComment(text: string, comments: CommentEntry[], index: number): boolean {
  const comment = comments[index]?.range;

  if (comment === undefined || comment.kind !== 'line' || isStandaloneLineComment(text, comment)) {
    return false;
  }

  let cursor = getLineStart(text, comment.start);

  for (let previousIndex = index - 1; previousIndex >= 0; previousIndex -= 1) {
    const previousComment = comments[previousIndex]?.range;

    if (previousComment !== undefined && previousComment.end > cursor) {
      continue;
    }

    if (previousComment === undefined || !isStandaloneComment(text, previousComment)) {
      return false;
    }

    if (!isAdjacentCommentBeforeIndex(text, previousComment, cursor)) {
      return false;
    }

    const body = getCommentBody(text, previousComment);

    if (previousComment.kind === 'line' && isPrettierIgnoreComment(body)) {
      return true;
    }

    if (!isCommentNormallyIgnored(text, previousComment)) {
      return false;
    }

    cursor = getLineStart(text, previousComment.start);
  }

  return false;
}

function isCommentNormallyIgnored(text: string, comment: CommentRange): boolean {
  if (comment.kind === 'line') {
    const raw = text.slice(comment.start, comment.end);

    return shouldSkipLineComment(text, comment) && !isPrettierIgnoreComment(normalizeLineCommentBody(raw.slice(2)));
  }

  return isBlockCommentNormallyIgnored(text, comment);
}

function isBlockCommentNormallyIgnored(text: string, comment: CommentRange): boolean {
  const raw = text.slice(comment.start, comment.end);

  if (raw.startsWith('/**') || hasPreserveCommentMarker(raw)) {
    return true;
  }

  const body = normalizeBlockCommentBody(raw);

  return body.trim() === '' || isDirectiveComment(body);
}

function isStandaloneComment(text: string, comment: CommentRange): boolean {
  return comment.kind === 'line' ? isStandaloneLineComment(text, comment) : isStandaloneBlockComment(text, comment);
}

function isAdjacentPreviousComment(text: string, previousComment: CommentRange, comment: CommentRange): boolean {
  return /^(?:\r\n|\n|\r)[ \t]*$/u.test(text.slice(previousComment.end, comment.start));
}

function isAdjacentCommentBeforeIndex(text: string, comment: CommentRange, index: number): boolean {
  return /^(?:\r\n|\n|\r)[ \t]*$/u.test(text.slice(comment.end, index));
}

function getCommentBody(text: string, comment: CommentRange): string {
  const raw = text.slice(comment.start, comment.end);

  return comment.kind === 'line' ? normalizeLineCommentBody(raw.slice(2)) : normalizeBlockCommentBody(raw);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}
