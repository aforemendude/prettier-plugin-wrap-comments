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
import { applyReplacements, getColumnAt, getLineStart, isStandaloneBlockComment } from '../shared/text.js';
import type { CommentRange, RawComment, Replacement, WrapOptions } from '../shared/types.js';

const NEUTRALIZED_PRETTIER_IGNORE_COMMENT = 'prettier-ignore wrap-comments';

export async function wrapComments<T>(text: string, ast: T, options: WrapOptions): Promise<string> {
  const commentEntries = collectSortedCommentEntries(ast, text);
  const comments = commentEntries.map((entry) => entry.range);

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

function collectSortedCommentEntries<T>(ast: T, text: string): CommentEntry[] {
  return collectComments(ast)
    .map((raw) => ({ range: toCommentRange(raw, text), raw }))
    .filter((entry): entry is CommentEntry => entry.range !== undefined)
    .sort((left, right) => left.range.start - right.range.start);
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
