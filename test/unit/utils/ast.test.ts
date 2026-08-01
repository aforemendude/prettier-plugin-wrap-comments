import { describe, expect, it } from 'vitest';

import { getAstNodeRange, visitAstNodes } from '../../../src/utils/ast.js';

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
