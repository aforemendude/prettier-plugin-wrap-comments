import type { CommentRange } from './comment-ranges.js';
import { isStandaloneBlockComment } from './comment-location.js';
import type { PrinterCommentLayout } from './printer-layout.js';
import type { BlockCommentLayout } from './wrap-block-comment.js';
import { getAstNodeRange, visitAstNodes } from '../utils/ast.js';
import type { SourceRange } from '../utils/ast.js';
import { getColumns } from '../utils/display-width.js';
import { getLeadingIndent } from '../utils/indentation.js';
import { getLinePrefix } from '../utils/source-lines.js';
import { isRecord } from '../utils/type-guards.js';
import { skipWhitespace, trimWhitespaceEnd } from '../utils/whitespace.js';

export type JsxExpressionContainerRange = SourceRange & {
  expression: SourceRange | undefined;
};

export function collectJsxExpressionContainerRanges(ast: unknown): JsxExpressionContainerRange[] {
  const ranges: JsxExpressionContainerRange[] = [];

  visitAstNodes(ast, (node) => {
    if (node['type'] !== 'JSXExpressionContainer') {
      return;
    }

    const range = getAstNodeRange(node);

    if (range === undefined) {
      return;
    }

    const expressionNode = node['expression'];
    const expression =
      isRecord(expressionNode) && expressionNode['type'] !== 'JSXEmptyExpression'
        ? getAstNodeRange(expressionNode)
        : undefined;

    ranges.push({ ...range, expression });
  });

  return ranges.sort((left, right) => left.start - right.start || right.end - left.end);
}

export function getPrintedJsxCommentMarkerColumn(text: string, container: SourceRange, tabWidth: number): number {
  const linePrefix = getLinePrefix(text, container.start);
  const lineIndent = getLeadingIndent(linePrefix);

  return getColumns(lineIndent, tabWidth) + tabWidth;
}

export function getJsxExpressionBlockCommentLayout(
  text: string,
  comment: CommentRange,
  previousComment: CommentRange | undefined,
  containers: JsxExpressionContainerRange[],
  tabWidth: number,
  outputCommentLayout: PrinterCommentLayout | undefined,
  outputCommentMarkerColumns: Array<number | undefined>,
): BlockCommentLayout | undefined {
  const container = getSmallestContainingRange(comment, containers);

  if (container === undefined || text[container.start] !== '{' || text[container.end - 1] !== '}') {
    return undefined;
  }

  const hasExpressionBeforeComment = container.expression !== undefined && container.expression.start < comment.start;
  const hasExpressionAfterComment = container.expression !== undefined && container.expression.end > comment.end;
  const containerIndex = containers.indexOf(container);
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

  const lineIndent = getLeadingIndent(linePrefix);

  return getColumns(lineIndent, tabWidth) + tabWidth;
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
