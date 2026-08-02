import type { CommentRange } from './comment-ranges.js';
import { getAstNodeRange, visitAstNodes } from '../utils/ast.js';
import type { SourceRange } from '../utils/ast.js';
import { isRecord, numberOrUndefined } from '../utils/type-guards.js';

const JSX_EMBEDDED_EXPRESSION_TYPES = new Set(['JSXExpressionContainer', 'JSXSpreadAttribute', 'JSXSpreadChild']);

export function collectEmbeddedExpressionRanges(ast: unknown): SourceRange[] {
  const ranges: SourceRange[] = [];

  visitAstNodes(ast, (node) => {
    const type = node['type'];

    if (typeof type !== 'string') {
      return;
    }

    if (JSX_EMBEDDED_EXPRESSION_TYPES.has(type)) {
      const range = getAstNodeRange(node);

      if (range !== undefined) {
        ranges.push(range);
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
  return ranges.some((range) => range.start < comment.start && comment.end < range.end);
}

function collectTemplateInterpolationRanges(
  node: Record<string, unknown>,
  expressionsKey: 'expressions' | 'types',
  ranges: SourceRange[],
): void {
  const quasis = node['quasis'];
  const expressions = node[expressionsKey];

  if (!Array.isArray(quasis) || !Array.isArray(expressions) || quasis.length !== expressions.length + 1) {
    return;
  }

  for (let index = 0; index < expressions.length; index += 1) {
    const precedingQuasi = getNodeBoundary(quasis[index]);
    const followingQuasi = getNodeBoundary(quasis[index + 1]);

    if (precedingQuasi === undefined || followingQuasi === undefined || precedingQuasi.end >= followingQuasi.start) {
      continue;
    }

    ranges.push({ end: followingQuasi.start, start: precedingQuasi.end });
  }
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
