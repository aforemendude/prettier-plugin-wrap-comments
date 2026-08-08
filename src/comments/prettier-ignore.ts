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
import { collectAstNodeRangesByStart, getAstNodeRange, visitAstNodes } from '../utils/ast.js';
import type { SourceRange } from '../utils/ast.js';
import { getLineEnd, getLineStart } from '../utils/source-lines.js';
import { isRecord } from '../utils/type-guards.js';
import { skipWhitespace } from '../utils/whitespace.js';

const NEUTRALIZED_PRETTIER_IGNORE_COMMENT = 'prettier-ignore wrap-comments';
const neutralizedPrettierIgnoreOriginalTextKey = Symbol('neutralizedPrettierIgnoreOriginalText');

type NeutralizedPrettierIgnoreComment = Record<string, unknown> & {
  [neutralizedPrettierIgnoreOriginalTextKey]?: string;
};

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
      if (previousEntry.range.kind === 'block') {
        const originalText = text.slice(previousEntry.range.start, previousEntry.range.end);

        (previousEntry.raw as NeutralizedPrettierIgnoreComment)[neutralizedPrettierIgnoreOriginalTextKey] =
          originalText;
      }

      previousEntry.raw.value = NEUTRALIZED_PRETTIER_IGNORE_COMMENT;
    }
  }

  return ast;
}

export function getNeutralizedPrettierIgnoreOriginalText(comment: unknown): string | undefined {
  if (!isRecord(comment)) {
    return undefined;
  }

  const originalText = (comment as NeutralizedPrettierIgnoreComment)[neutralizedPrettierIgnoreOriginalTextKey];

  return typeof originalText === 'string' ? originalText : undefined;
}

export function collectPrettierIgnoredLineRanges(text: string, ast: unknown, comments: CommentEntry[]): SourceRange[] {
  const nodeRangesByStart = collectAstNodeRangesByStart(ast);
  const jsxTargetRangesByIgnoreStart = collectJsxPrettierIgnoreTargetRanges(text, ast, comments);
  const ignoredLineRanges: SourceRange[] = [];

  for (let index = 0; index < comments.length; index += 1) {
    const comment = comments[index]?.range;
    const jsxTargetRange = comment === undefined ? undefined : jsxTargetRangesByIgnoreStart.get(comment.start);

    if (
      comment === undefined ||
      (!isStandaloneComment(text, comment) && jsxTargetRange === undefined) ||
      !isPrettierIgnoreComment(getCommentBody(text, comment))
    ) {
      continue;
    }

    let targetRange = jsxTargetRange;

    if (targetRange === undefined) {
      const targetStart = getPrettierIgnoreTargetStart(text, comments, index);

      if (targetStart === undefined) {
        continue;
      }

      targetRange = nodeRangesByStart.get(targetStart);
    }

    if (targetRange === undefined) {
      continue;
    }

    appendMergedRange(ignoredLineRanges, {
      end: getLineEnd(text, targetRange.end),
      start: getLineStart(text, targetRange.start),
    });
  }

  return ignoredLineRanges;
}

export function isCommentInIgnoredLineRange(comment: CommentRange, ignoredLineRange: SourceRange | undefined): boolean {
  return (
    ignoredLineRange !== undefined && comment.start >= ignoredLineRange.start && comment.start < ignoredLineRange.end
  );
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

function collectJsxPrettierIgnoreTargetRanges(
  text: string,
  ast: unknown,
  comments: CommentEntry[],
): Map<number, SourceRange> {
  const commentsByStart = new Map(comments.map((entry) => [entry.range.start, entry.range]));
  const targetRangesByIgnoreStart = new Map<number, SourceRange>();

  visitAstNodes(ast, (node) => {
    if (!isJsxElementOrFragment(node)) {
      return;
    }

    const children = node['children'];

    if (!Array.isArray(children)) {
      return;
    }

    for (let ignoreIndex = 0; ignoreIndex < children.length; ignoreIndex += 1) {
      const ignoreContainer = children[ignoreIndex];

      if (!isRecord(ignoreContainer)) {
        continue;
      }

      const ignoreComment = getCommentOnlyJsxExpressionContainerComment(text, ignoreContainer, commentsByStart);

      if (ignoreComment === undefined || !isPrettierIgnoreComment(getCommentBody(text, ignoreComment))) {
        continue;
      }

      const target = getNextSignificantJsxChild(text, children, ignoreIndex);

      if (target === undefined || !isJsxElementOrFragment(target)) {
        continue;
      }

      const targetRange = getAstNodeRange(target);

      if (targetRange !== undefined) {
        targetRangesByIgnoreStart.set(ignoreComment.start, targetRange);
      }
    }
  });

  return targetRangesByIgnoreStart;
}

function getNextSignificantJsxChild(
  text: string,
  children: unknown[],
  ignoreIndex: number,
): Record<string, unknown> | undefined {
  for (let index = ignoreIndex + 1; index < children.length; index += 1) {
    const child = children[index];

    if (!isRecord(child)) {
      return undefined;
    }

    if (isMultilineWhitespaceJsxText(text, child)) {
      continue;
    }

    return child;
  }

  return undefined;
}

function isMultilineWhitespaceJsxText(text: string, node: Record<string, unknown>): boolean {
  if (node['type'] !== 'JSXText') {
    return false;
  }

  const range = getAstNodeRange(node);

  if (range === undefined) {
    return false;
  }

  const raw = text.slice(range.start, range.end);

  // Native Prettier skips multiline whitespace-only JSXText siblings when finding the node after an ignore marker, but
  // treats same-line whitespace as a significant child.
  return raw.includes('\n') && /^[ \t\r\n]*$/u.test(raw);
}

function getCommentOnlyJsxExpressionContainerComment(
  text: string,
  container: Record<string, unknown>,
  commentsByStart: Map<number, CommentRange>,
): CommentRange | undefined {
  const expression = container['expression'];

  if (
    container['type'] !== 'JSXExpressionContainer' ||
    !isRecord(expression) ||
    expression['type'] !== 'JSXEmptyExpression'
  ) {
    return undefined;
  }

  const range = getAstNodeRange(container);

  if (range === undefined || text[range.start] !== '{' || text[range.end - 1] !== '}') {
    return undefined;
  }

  const commentStart = skipWhitespace(text, range.start + 1);
  const comment = commentsByStart.get(commentStart);

  if (comment === undefined || comment.kind !== 'block' || skipWhitespace(text, comment.end) !== range.end - 1) {
    return undefined;
  }

  return comment;
}

function isJsxElementOrFragment(node: Record<string, unknown>): boolean {
  return node['type'] === 'JSXElement' || node['type'] === 'JSXFragment';
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

function appendMergedRange(ranges: SourceRange[], range: SourceRange): void {
  const previousRange = ranges[ranges.length - 1];

  if (previousRange === undefined || range.start > previousRange.end) {
    ranges.push(range);
    return;
  }

  previousRange.end = Math.max(previousRange.end, range.end);
}
