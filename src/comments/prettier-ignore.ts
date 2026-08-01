import { getCommentBody } from './comment-body.js';
import { isPrettierIgnoreComment } from './comment-directives.js';
import { shouldSkipBlockComment, shouldSkipLineComment } from './comment-eligibility.js';
import {
  areCommentsOnAdjacentLines,
  isCommentAdjacentBeforeIndex,
  isStandaloneBlockComment,
  isStandaloneComment,
  isStandaloneLineComment,
} from './comment-location.js';
import { collectCommentEntries } from './comment-ranges.js';
import type { CommentEntry, CommentRange } from './comment-ranges.js';
import { getAstNodeRange, visitAstNodes } from '../utils/ast.js';
import type { SourceRange } from '../utils/ast.js';
import { getLineEnd, getLineStart } from '../utils/source-lines.js';
import { skipWhitespace } from '../utils/whitespace.js';

const NEUTRALIZED_PRETTIER_IGNORE_COMMENT = 'prettier-ignore wrap-comments';

export function neutralizePrettierIgnoreForIgnoredComments<T>(text: string, ast: T): T {
  const comments = collectCommentEntries(ast, text);

  for (let index = 0; index < comments.length; index += 1) {
    const entry = comments[index];
    const previousEntry = comments[index - 1];
    const shouldNeutralize =
      entry !== undefined &&
      previousEntry !== undefined &&
      ((isPrettierIgnoredBlockComment(text, comments, index) && !shouldSkipBlockComment(text, entry.range)) ||
        (isPrettierIgnoredStandaloneLineComment(text, comments, index) && !shouldSkipLineComment(text, entry.range)));

    if (shouldNeutralize) {
      previousEntry.raw.value = NEUTRALIZED_PRETTIER_IGNORE_COMMENT;
    }
  }

  return ast;
}

export function collectPrettierIgnoredLineRanges(text: string, ast: unknown, comments: CommentEntry[]): SourceRange[] {
  const nodeRanges = collectAstNodeRanges(ast);
  const ignoredLineRanges: SourceRange[] = [];

  for (let index = 0; index < comments.length; index += 1) {
    const comment = comments[index]?.range;

    if (
      comment === undefined ||
      !isStandaloneComment(text, comment) ||
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

export function isCommentInIgnoredLineRange(comment: CommentRange, ignoredLineRanges: SourceRange[]): boolean {
  return ignoredLineRanges.some((range) => comment.start >= range.start && comment.start < range.end);
}

export function isPrettierIgnoredBlockComment(text: string, comments: CommentEntry[], index: number): boolean {
  const comment = comments[index]?.range;
  const previousComment = comments[index - 1]?.range;

  if (
    comment === undefined ||
    comment.kind !== 'block' ||
    !isStandaloneBlockComment(text, comment) ||
    previousComment === undefined
  ) {
    return false;
  }

  if (!isStandaloneComment(text, previousComment) || !areCommentsOnAdjacentLines(text, previousComment, comment)) {
    return false;
  }

  return isPrettierIgnoreComment(getCommentBody(text, previousComment));
}

export function isPrettierIgnoredStandaloneLineComment(text: string, comments: CommentEntry[], index: number): boolean {
  const comment = comments[index]?.range;
  const previousComment = comments[index - 1]?.range;

  if (
    comment === undefined ||
    comment.kind !== 'line' ||
    !isStandaloneLineComment(text, comment) ||
    previousComment === undefined ||
    previousComment.kind !== 'line'
  ) {
    return false;
  }

  if (!isStandaloneComment(text, previousComment) || !areCommentsOnAdjacentLines(text, previousComment, comment)) {
    return false;
  }

  return isPrettierIgnoreComment(getCommentBody(text, previousComment));
}

export function isPrettierIgnoredTrailingLineComment(text: string, comments: CommentEntry[], index: number): boolean {
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

    if (!isCommentAdjacentBeforeIndex(text, previousComment, cursor)) {
      return false;
    }

    const body = getCommentBody(text, previousComment);

    if (isPrettierIgnoreComment(body)) {
      return true;
    }

    if (!isSkippableCommentBetweenIgnoreAndTarget(text, previousComment)) {
      return false;
    }

    cursor = getLineStart(text, previousComment.start);
  }

  return false;
}

function collectAstNodeRanges(ast: unknown): SourceRange[] {
  const ranges: SourceRange[] = [];

  visitAstNodes(ast, (node) => {
    const range = getAstNodeRange(node);

    if (range !== undefined) {
      ranges.push(range);
    }
  });

  return ranges.sort((left, right) => left.start - right.start || right.end - left.end);
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

    if (!isStandaloneComment(text, comment) || !isSkippableCommentBetweenIgnoreAndTarget(text, comment)) {
      return undefined;
    }

    cursor = comment.end;
  }

  const targetStart = skipWhitespace(text, cursor);

  return targetStart >= text.length ? undefined : targetStart;
}

function isSkippableCommentBetweenIgnoreAndTarget(text: string, comment: CommentRange): boolean {
  if (comment.kind === 'block') {
    return shouldSkipBlockComment(text, comment);
  }

  return shouldSkipLineComment(text, comment) && !isPrettierIgnoreComment(getCommentBody(text, comment));
}
