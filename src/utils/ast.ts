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

export type ContainingRangeMatch<Range extends SourceRange> = {
  index: number;
  range: Range;
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

export function collectAstNodeRangesByStart(ast: unknown): Map<number, SourceRange> {
  const rangesByStart = new Map<number, SourceRange>();

  visitAstNodes(ast, (node) => {
    const range = getAstNodeRange(node);

    if (range === undefined) {
      return;
    }

    const existingRange = rangesByStart.get(range.start);

    if (existingRange === undefined || range.end > existingRange.end) {
      rangesByStart.set(range.start, range);
    }
  });

  return rangesByStart;
}

// Targets must be nonoverlapping and source ordered; containers must be source ordered and properly nested.
export function matchOrderedRangesToSmallestContainers<Range extends SourceRange>(
  targets: readonly SourceRange[],
  containers: readonly Range[],
): Array<ContainingRangeMatch<Range> | undefined> {
  const matches: Array<ContainingRangeMatch<Range> | undefined> = [];
  const openContainers: Array<ContainingRangeMatch<Range>> = [];
  let containerIndex = 0;

  for (const target of targets) {
    let container = containers[containerIndex];

    while (container !== undefined && container.start < target.start) {
      let previousContainer = openContainers[openContainers.length - 1];

      while (previousContainer !== undefined && previousContainer.range.end <= container.start) {
        openContainers.pop();
        previousContainer = openContainers[openContainers.length - 1];
      }

      // Equal ranges have equal containment, and the former full scan preferred the first one.
      if (
        previousContainer === undefined ||
        previousContainer.range.start !== container.start ||
        previousContainer.range.end !== container.end
      ) {
        openContainers.push({ index: containerIndex, range: container });
      }

      containerIndex += 1;
      container = containers[containerIndex];
    }

    let containingRange = openContainers[openContainers.length - 1];

    while (containingRange !== undefined && containingRange.range.end <= target.end) {
      openContainers.pop();
      containingRange = openContainers[openContainers.length - 1];
    }

    matches.push(containingRange);
  }

  return matches;
}

function getRangeNumber(range: unknown, index: number): number | undefined {
  if (!Array.isArray(range)) {
    return undefined;
  }

  return numberOrUndefined(range[index]);
}
