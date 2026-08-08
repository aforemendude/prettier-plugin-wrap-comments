import { describe, expect, it } from 'vitest';

import {
  collectAstNodeRangesByStart,
  getAstNodeRange,
  matchOrderedRangesToSmallestContainers,
  visitAstNodes,
} from '../../../src/utils/ast.js';

describe('visitAstNodes', () => {
  it('visits typed nodes through nested objects and arrays in traversal order', () => {
    const ast = {
      children: [
        { type: 'FirstChild' },
        {
          wrapper: {
            type: 'SecondChild',
          },
        },
      ],
      type: 'Root',
    };
    const visitedTypes: string[] = [];

    visitAstNodes(ast, (node) => {
      const type = node['type'];

      if (typeof type === 'string') {
        visitedTypes.push(type);
      }
    });

    expect(visitedTypes).toEqual(['Root', 'FirstChild', 'SecondChild']);
  });

  it('skips AST metadata and does not revisit shared or cyclic objects', () => {
    const child: Record<string, unknown> = { type: 'Child' };
    const ast: Record<string, unknown> = {
      child,
      comments: [{ type: 'Comment' }],
      loc: { type: 'Location' },
      tokens: [{ type: 'Token' }],
      type: 'Root',
    };
    const visitedTypes: string[] = [];

    ast['duplicateChild'] = child;
    ast['self'] = ast;
    child['parent'] = ast;

    visitAstNodes(ast, (node) => {
      const type = node['type'];

      if (typeof type === 'string') {
        visitedTypes.push(type);
      }
    });

    expect(visitedTypes).toEqual(['Root', 'Child']);
  });
});

describe('getAstNodeRange', () => {
  it('uses direct offsets before range-array fallbacks', () => {
    expect(getAstNodeRange({ end: 8, range: [20, 30], start: 2 })).toEqual({ end: 8, start: 2 });
    expect(getAstNodeRange({ range: [3, 9] })).toEqual({ end: 9, start: 3 });
    expect(getAstNodeRange({ range: [1, 10], start: 4 })).toEqual({ end: 10, start: 4 });
  });

  it('rejects missing, nonnumeric, empty, and reversed ranges', () => {
    expect(getAstNodeRange({ start: 1 })).toBeUndefined();
    expect(getAstNodeRange({ range: ['1', 4] })).toBeUndefined();
    expect(getAstNodeRange({ end: 3, start: 3 })).toBeUndefined();
    expect(getAstNodeRange({ end: 2, start: 3 })).toBeUndefined();
  });
});

describe('collectAstNodeRangesByStart', () => {
  it('maps each start to the widest AST node range', () => {
    const ast = {
      child: {
        end: 10,
        sibling: { end: 9, start: 5, type: 'Sibling' },
        start: 0,
        type: 'Child',
      },
      end: 20,
      start: 0,
      type: 'Root',
    };

    expect(collectAstNodeRangesByStart(ast)).toEqual(
      new Map([
        [0, { end: 20, start: 0 }],
        [5, { end: 9, start: 5 }],
      ]),
    );
  });
});

describe('matchOrderedRangesToSmallestContainers', () => {
  it('matches nested and disjoint ranges while retaining each container index', () => {
    const targets = [
      { end: 13, start: 12 },
      { end: 26, start: 25 },
      { end: 41, start: 40 },
      { end: 91, start: 90 },
      { end: 102, start: 101 },
    ];
    const containers = [
      { end: 100, name: 'outer', start: 0 },
      { end: 100, name: 'duplicate outer', start: 0 },
      { end: 80, name: 'inner', start: 0 },
      { end: 20, name: 'earlier child', start: 10 },
      { end: 70, name: 'later child', start: 30 },
    ];
    const matches = matchOrderedRangesToSmallestContainers(targets, containers);

    expect(matches.map((match) => match?.index)).toEqual([3, 2, 4, 0, undefined]);
    expect(matches.map((match) => match?.range.name)).toEqual([
      'earlier child',
      'inner',
      'later child',
      'outer',
      undefined,
    ]);
  });

  it('handles large ordered collections in a single matching pass', () => {
    const rangeCount = 20_000;
    const containers = Array.from({ length: rangeCount }, (_value, index) => ({
      end: index * 4 + 3,
      start: index * 4,
    }));
    const targets = containers.map((container) => ({ end: container.end - 1, start: container.start + 1 }));
    const matches = matchOrderedRangesToSmallestContainers(targets, containers);

    expect(matches).toHaveLength(rangeCount);
    expect(matches.every((match, index) => match?.index === index)).toBe(true);
  });
});
