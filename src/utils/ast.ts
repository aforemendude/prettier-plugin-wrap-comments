import { isRecord, numberOrUndefined } from './type-guards.js';

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

export type SourceRange = {
  end: number;
  start: number;
};

export function visitAstNodes(ast: unknown, visitor: (node: Record<string, unknown>) => void): void {
  const seen = new Set<object>();

  visit(ast);

  function visit(value: unknown): void {
    if (!isRecord(value) || seen.has(value)) {
      return;
    }

    seen.add(value);

    if (typeof value['type'] === 'string') {
      visitor(value);
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

export function getAstNodeRange(node: Record<string, unknown>): SourceRange | undefined {
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
