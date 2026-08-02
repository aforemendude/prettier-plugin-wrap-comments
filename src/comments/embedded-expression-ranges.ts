import type { CommentRange } from './comment-ranges.js';
import { getAstNodeRange, visitAstNodes } from '../utils/ast.js';
import type { SourceRange } from '../utils/ast.js';
import { getLineEnd } from '../utils/source-lines.js';
import { isRecord, numberOrUndefined } from '../utils/type-guards.js';

const JSX_EMBEDDED_EXPRESSION_TYPES = new Set(['JSXExpressionContainer', 'JSXSpreadAttribute', 'JSXSpreadChild']);

export type EmbeddedExpressionRange = SourceRange & {
  expression?: SourceRange;
};

export type EmbeddedTrailingLineCommentMove = {
  insertAt: number;
  removeStart: number;
};

export function collectEmbeddedExpressionRanges(ast: unknown): EmbeddedExpressionRange[] {
  const ranges: EmbeddedExpressionRange[] = [];

  visitAstNodes(ast, (node) => {
    const type = node['type'];

    if (typeof type !== 'string') {
      return;
    }

    if (JSX_EMBEDDED_EXPRESSION_TYPES.has(type)) {
      const range = getAstNodeRange(node);

      if (range !== undefined) {
        const expressionNode = type === 'JSXExpressionContainer' ? node['expression'] : undefined;
        const expression = isRecord(expressionNode) ? getAstNodeRange(expressionNode) : undefined;

        ranges.push(expression === undefined ? range : { ...range, expression });
      }

      return;
    }

    if (type === 'TemplateLiteral') {
      collectTemplateInterpolationRanges(node, 'expressions', ranges);
    } else if (type === 'TSTemplateLiteralType') {
      collectTemplateInterpolationRanges(node, 'types', ranges);
    }
  });

  return ranges.sort((left, right) => left.start - right.start || right.end - left.end);
}

export function isCommentInEmbeddedExpression(comment: CommentRange, ranges: SourceRange[]): boolean {
  return getSmallestContainingRange(comment, ranges) !== undefined;
}

export function getEmbeddedTrailingLineCommentMove(
  text: string,
  comment: CommentRange,
  ranges: EmbeddedExpressionRange[],
): EmbeddedTrailingLineCommentMove | undefined {
  const range = getSmallestContainingRange(comment, ranges);
  const expression = range?.expression;

  if (
    expression === undefined ||
    expression.end > comment.start ||
    !/^[\t ]*$/u.test(text.slice(expression.end, comment.start))
  ) {
    return undefined;
  }

  return { insertAt: expression.start, removeStart: expression.end };
}

export function doesBlockCommentSeparateEmbeddedTrailingLineComment(
  text: string,
  blockComment: CommentRange,
  nextComment: CommentRange | undefined,
  ranges: EmbeddedExpressionRange[],
): boolean {
  if (
    blockComment.kind !== 'block' ||
    nextComment?.kind !== 'line' ||
    blockComment.end >= nextComment.start ||
    nextComment.end > getLineEnd(text, blockComment.start)
  ) {
    return false;
  }

  const range = getSmallestContainingRange(blockComment, ranges);
  const nextRange = getSmallestContainingRange(nextComment, ranges);
  const expression = range?.expression;

  return (
    range !== undefined &&
    range === nextRange &&
    expression !== undefined &&
    expression.end <= blockComment.start &&
    /^[\t ]*$/u.test(text.slice(expression.end, blockComment.start)) &&
    /^[\t ]*$/u.test(text.slice(blockComment.end, nextComment.start))
  );
}

function collectTemplateInterpolationRanges(
  node: Record<string, unknown>,
  expressionsKey: 'expressions' | 'types',
  ranges: EmbeddedExpressionRange[],
): void {
  const quasis = node['quasis'];
  const expressions = node[expressionsKey];

  if (!Array.isArray(quasis) || !Array.isArray(expressions) || quasis.length !== expressions.length + 1) {
    return;
  }

  for (let index = 0; index < expressions.length; index += 1) {
    const precedingQuasi = getNodeBoundary(quasis[index]);
    const followingQuasi = getNodeBoundary(quasis[index + 1]);
    const expression = getExpressionRange(expressions[index]);

    if (
      precedingQuasi === undefined ||
      followingQuasi === undefined ||
      expression === undefined ||
      precedingQuasi.end >= followingQuasi.start
    ) {
      continue;
    }

    ranges.push({ end: followingQuasi.start, expression, start: precedingQuasi.end });
  }
}

function getExpressionRange(value: unknown): SourceRange | undefined {
  return isRecord(value) ? getAstNodeRange(value) : undefined;
}

function getNodeBoundary(value: unknown): SourceRange | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const range = Array.isArray(value['range']) ? value['range'] : undefined;
  const start = numberOrUndefined(value['start']) ?? numberOrUndefined(range?.[0]);
  const end = numberOrUndefined(value['end']) ?? numberOrUndefined(range?.[1]);

  if (start === undefined || end === undefined || start > end) {
    return undefined;
  }

  return { end, start };
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
