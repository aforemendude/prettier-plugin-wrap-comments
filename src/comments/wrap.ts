import { wrapBlockComment } from './block.js';
import type { BlockCommentLayout } from './block.js';
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
import {
  applyReplacements,
  getColumnAt,
  getColumns,
  getLineEnd,
  getLinePrefix,
  getLineStart,
  isStandaloneBlockComment,
} from '../shared/text.js';
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

export type PrinterLayoutSource = {
  ast: unknown;
  text: string;
};

export async function wrapComments<T>(
  text: string,
  ast: T,
  options: WrapOptions,
  printerLayoutSource?: PrinterLayoutSource,
): Promise<string> {
  const commentEntries = collectSortedCommentEntries(ast, text);
  const comments = commentEntries.map((entry) => entry.range);
  const jsxExpressionContainers = collectJsxExpressionContainerRanges(ast);
  const ignoredLineRanges = collectPrettierIgnoredLineRanges(text, ast, commentEntries);

  if (comments.length === 0) {
    return text;
  }

  const replacements: Replacement[] = [];
  const tabWidth = getTabWidth(options);
  const printerLayout = getPrinterLayout(text, commentEntries, jsxExpressionContainers, printerLayoutSource, tabWidth);

  for (let index = 0; index < comments.length; index += 1) {
    const comment = comments[index];
    const outputCommentLayout = printerLayout.comments[index];

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

      const jsxLayout = getJsxExpressionBlockCommentLayout(
        text,
        comment,
        comments[index - 1],
        jsxExpressionContainers,
        tabWidth,
        outputCommentLayout,
        printerLayout.jsxCommentMarkerColumns,
      );

      if (jsxLayout?.placement === 'inline') {
        continue;
      }

      const outputLayout =
        outputCommentLayout === undefined
          ? undefined
          : {
              markerColumn: outputCommentLayout.markerColumn,
              placement: isStandaloneBlockComment(text, comment) ? ('standalone' as const) : ('inline' as const),
            };
      const replacement = await wrapBlockComment(text, comment, options, jsxLayout ?? outputLayout);

      if (Array.isArray(replacement)) {
        replacements.push(...replacement);
      } else if (replacement !== undefined) {
        replacements.push(replacement);
      }

      continue;
    }

    if (shouldSkipLineComment(text, comment)) {
      continue;
    }

    if (isPrettierIgnoredStandaloneLineComment(text, commentEntries, index)) {
      index = getStandaloneLineCommentGroupEndIndex(text, comments, index, tabWidth);
      continue;
    }

    if (!isStandaloneLineComment(text, comment)) {
      if (isPrettierIgnoredTrailingLineComment(text, commentEntries, index)) {
        continue;
      }

      const replacement = await wrapTrailingLineComment(text, comment, options, outputCommentLayout);

      if (replacement !== undefined) {
        replacements.push(...replacement);
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

    const replacement = await wrapLineCommentGroup(text, group, options, outputCommentLayout?.markerColumn);

    if (replacement !== undefined) {
      replacements.push(replacement);
    }
  }

  return applyReplacements(text, replacements);
}

export function neutralizePrettierIgnoreForIgnoredComments<T>(text: string, ast: T): T {
  const comments = collectSortedCommentEntries(ast, text);

  for (let index = 0; index < comments.length; index += 1) {
    const entry = comments[index];
    const previousEntry = comments[index - 1];
    const shouldNeutralize =
      entry !== undefined &&
      previousEntry !== undefined &&
      ((isPrettierIgnoredBlockComment(text, comments, index) && !isBlockCommentNormallyIgnored(text, entry.range)) ||
        (isPrettierIgnoredStandaloneLineComment(text, comments, index) && !shouldSkipLineComment(text, entry.range)));

    if (shouldNeutralize) {
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

type JsxExpressionContainerRange = SourceRange & {
  expression: SourceRange | undefined;
};

type PrinterCommentLayout = {
  lineIndentColumn: number;
  lineWidth: number;
  markerColumn: number;
  suffixWidth: number;
};

type PrinterLayout = {
  comments: Array<PrinterCommentLayout | undefined>;
  jsxCommentMarkerColumns: Array<number | undefined>;
};

function getPrinterLayout(
  text: string,
  commentEntries: CommentEntry[],
  jsxExpressionContainers: JsxExpressionContainerRange[],
  source: PrinterLayoutSource | undefined,
  tabWidth: number,
): PrinterLayout {
  if (source === undefined) {
    return {
      comments: [],
      jsxCommentMarkerColumns: [],
    };
  }

  const outputCommentEntries = collectSortedCommentEntries(source.ast, source.text);
  const alignedOutputComments = alignOutputComments(text, commentEntries, source.text, outputCommentEntries);
  const outputJsxExpressionContainers = collectJsxExpressionContainerRanges(source.ast);
  const jsxCommentMarkerColumns =
    outputJsxExpressionContainers.length === jsxExpressionContainers.length
      ? outputJsxExpressionContainers.map((container) =>
          getJsxExpressionCommentMarkerColumn(source.text, container, tabWidth),
        )
      : [];

  return {
    comments: alignedOutputComments.map((comment) =>
      comment === undefined ? undefined : getPrinterCommentLayout(source.text, comment.range, tabWidth),
    ),
    jsxCommentMarkerColumns,
  };
}

function alignOutputComments(
  text: string,
  comments: CommentEntry[],
  outputText: string,
  outputComments: CommentEntry[],
): Array<CommentEntry | undefined> {
  if (
    comments.length === outputComments.length &&
    comments.every((comment, index) => comment.range.kind === outputComments[index]?.range.kind)
  ) {
    return outputComments;
  }

  const alignedComments: Array<CommentEntry | undefined> = [];
  let outputIndex = 0;

  for (const comment of comments) {
    const raw = normalizeCommentForMatching(text.slice(comment.range.start, comment.range.end));
    let matchingComment: CommentEntry | undefined;

    while (outputIndex < outputComments.length) {
      const candidate = outputComments[outputIndex];
      outputIndex += 1;

      if (
        candidate !== undefined &&
        candidate.range.kind === comment.range.kind &&
        normalizeCommentForMatching(outputText.slice(candidate.range.start, candidate.range.end)) === raw
      ) {
        matchingComment = candidate;
        break;
      }
    }

    alignedComments.push(matchingComment);
  }

  return alignedComments;
}

function normalizeCommentForMatching(raw: string): string {
  return raw.replace(/\r\n?/gu, '\n');
}

function getPrinterCommentLayout(text: string, comment: CommentRange, tabWidth: number): PrinterCommentLayout {
  const lineStart = getLineStart(text, comment.start);
  const lineEnd = getLineEnd(text, comment.end);
  const linePrefix = text.slice(lineStart, comment.start);
  const lineIndent = /^[ \t]*/u.exec(linePrefix)?.[0] ?? '';
  const lineText = text.slice(lineStart, lineEnd).replace(/[ \t]+$/u, '');
  const suffix = text.slice(comment.end, lineEnd).replace(/[ \t]+$/u, '');

  return {
    lineIndentColumn: getColumns(lineIndent, tabWidth),
    lineWidth: getColumns(lineText, tabWidth),
    markerColumn: getColumns(linePrefix, tabWidth),
    suffixWidth: getColumns(suffix, tabWidth),
  };
}

function getJsxExpressionCommentMarkerColumn(text: string, container: SourceRange, tabWidth: number): number {
  const linePrefix = getLinePrefix(text, container.start);
  const lineIndent = /^[ \t]*/u.exec(linePrefix)?.[0] ?? '';

  return getColumns(lineIndent, tabWidth) + tabWidth;
}

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

function collectJsxExpressionContainerRanges(ast: unknown): JsxExpressionContainerRange[] {
  const ranges: JsxExpressionContainerRange[] = [];
  const seen = new Set<object>();

  visit(ast);

  return ranges.sort((left, right) => left.start - right.start || right.end - left.end);

  function visit(value: unknown): void {
    if (!isRecord(value) || seen.has(value)) {
      return;
    }

    seen.add(value);

    if (value['type'] === 'JSXExpressionContainer') {
      const range = getAstNodeRange(value);

      if (range !== undefined) {
        const expressionNode = value['expression'];
        const expression =
          isRecord(expressionNode) && expressionNode['type'] !== 'JSXEmptyExpression'
            ? getAstNodeRange(expressionNode)
            : undefined;

        ranges.push({ ...range, expression });
      }
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

function getJsxExpressionBlockCommentLayout(
  text: string,
  comment: CommentRange,
  previousComment: CommentRange | undefined,
  jsxExpressionContainers: JsxExpressionContainerRange[],
  tabWidth: number,
  outputCommentLayout: PrinterCommentLayout | undefined,
  outputCommentMarkerColumns: Array<number | undefined>,
): BlockCommentLayout | undefined {
  const container = getSmallestContainingRange(comment, jsxExpressionContainers);

  if (container === undefined || text[container.start] !== '{' || text[container.end - 1] !== '}') {
    return undefined;
  }

  const hasExpressionBeforeComment = container.expression !== undefined && container.expression.start < comment.start;
  const hasExpressionAfterComment = container.expression !== undefined && container.expression.end > comment.end;
  const containerIndex = jsxExpressionContainers.indexOf(container);
  const multilineMarkerColumn =
    outputCommentMarkerColumns[containerIndex] ??
    getJsxExpressionContainerOutputColumn(text, container, tabWidth) + tabWidth;
  const markerColumn = outputCommentLayout?.markerColumn ?? multilineMarkerColumn;
  const contentColumn = multilineMarkerColumn + 3;

  if (!hasExpressionBeforeComment && !hasExpressionAfterComment) {
    return {
      contentColumn,
      markerColumn,
      multilineIndent: '',
      placement: 'standalone',
      singleLineSuffixWidth: outputCommentLayout?.suffixWidth ?? 1,
    };
  }

  if (hasExpressionBeforeComment && !hasExpressionAfterComment) {
    const hasEarlierCommentInContainer =
      previousComment !== undefined && previousComment.start > container.start && previousComment.end < container.end;

    // Moving separate trailing replacements to the same expression start would reverse their source order.
    if (hasEarlierCommentInContainer) {
      return {
        contentColumn,
        markerColumn,
        multilineIndent: '',
        placement: 'standalone',
        singleLineSuffixWidth: outputCommentLayout?.suffixWidth ?? 1,
      };
    }

    const expressionStart = skipWhitespace(text, container.start + 1);
    const expressionEnd = trimWhitespaceEnd(text, container.start + 1, comment.start);
    const removalEnd = Math.min(skipWhitespace(text, comment.end), container.end - 1);

    return {
      contentColumn,
      markerColumn,
      multilineIndent: '',
      placement: 'trailing',
      singleLineSuffixWidth: outputCommentLayout?.suffixWidth ?? 1,
      trailingMove: {
        insertAt: expressionStart,
        removeEnd: removalEnd,
        removeStart: expressionEnd,
      },
    };
  }

  if (!hasExpressionBeforeComment) {
    if (isStandaloneBlockComment(text, comment)) {
      return { placement: 'inline' };
    }

    const expressionStart = skipWhitespace(text, comment.end);

    return {
      contentColumn,
      leadingMove: {
        removeEnd: expressionStart,
        removeStart: comment.end,
      },
      markerColumn,
      multilineIndent: '',
      placement: 'standalone',
      singleLineSuffixWidth:
        outputCommentLayout?.suffixWidth ?? getColumns(text.slice(comment.end, container.end), tabWidth),
    };
  }

  return { placement: 'inline' };
}

function getJsxExpressionContainerOutputColumn(text: string, container: SourceRange, tabWidth: number): number {
  const linePrefix = getLinePrefix(text, container.start);

  if (/^[ \t]*$/u.test(linePrefix)) {
    return getColumns(linePrefix, tabWidth);
  }

  const lineIndent = /^[ \t]*/u.exec(linePrefix)?.[0] ?? '';

  return getColumns(lineIndent, tabWidth) + tabWidth;
}

function trimWhitespaceEnd(text: string, start: number, end: number): number {
  let cursor = end;

  while (cursor > start) {
    const character = text[cursor - 1];

    if (character === undefined || !/\s/u.test(character)) {
      break;
    }

    cursor -= 1;
  }

  return cursor;
}

function getSmallestContainingRange<Range extends SourceRange>(
  comment: CommentRange,
  ranges: Range[],
): Range | undefined {
  let containingRange: Range | undefined;

  for (const range of ranges) {
    if (comment.start <= range.start || comment.end >= range.end) {
      continue;
    }

    if (containingRange === undefined || range.end - range.start < containingRange.end - containingRange.start) {
      containingRange = range;
    }
  }

  return containingRange;
}

function isPrettierIgnoredBlockComment(text: string, comments: CommentEntry[], index: number): boolean {
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

  if (!isStandaloneComment(text, previousComment) || !isAdjacentPreviousComment(text, previousComment, comment)) {
    return false;
  }

  return isPrettierIgnoreComment(getCommentBody(text, previousComment));
}

function isPrettierIgnoredStandaloneLineComment(text: string, comments: CommentEntry[], index: number): boolean {
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

  if (!isStandaloneComment(text, previousComment) || !isAdjacentPreviousComment(text, previousComment, comment)) {
    return false;
  }

  return isPrettierIgnoreComment(getCommentBody(text, previousComment));
}

function getStandaloneLineCommentGroupEndIndex(
  text: string,
  comments: CommentRange[],
  startIndex: number,
  tabWidth: number,
): number {
  const firstComment = comments[startIndex];

  if (firstComment === undefined) {
    return startIndex;
  }

  let endIndex = startIndex;
  let previousComment = firstComment;

  while (endIndex + 1 < comments.length) {
    const nextComment = comments[endIndex + 1];

    if (
      nextComment === undefined ||
      nextComment.kind !== 'line' ||
      !isStandaloneLineComment(text, nextComment) ||
      shouldSkipLineComment(text, nextComment) ||
      !areAdjacentLineComments(text, previousComment, nextComment) ||
      getColumnAt(text, firstComment.start, tabWidth) !== getColumnAt(text, nextComment.start, tabWidth)
    ) {
      break;
    }

    previousComment = nextComment;
    endIndex += 1;
  }

  return endIndex;
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

    if (isPrettierIgnoreComment(body)) {
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
