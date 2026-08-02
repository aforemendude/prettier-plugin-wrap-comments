import { describe, expect, it } from 'vitest';

import {
  collectEmbeddedExpressionRanges,
  isCommentInEmbeddedExpression,
} from '../../../src/comments/embedded-expression-ranges.js';
import { createCommentRange } from '../support/comments.js';

describe('collectEmbeddedExpressionRanges', () => {
  it('collects JSX containers, JSX spreads, and template interpolations', () => {
    const ast = {
      body: [
        { end: 30, start: 10, type: 'JSXExpressionContainer' },
        { range: [40, 60], type: 'JSXSpreadAttribute' },
        { end: 90, start: 70, type: 'JSXSpreadChild' },
        {
          end: 130,
          expressions: [{ end: 115, start: 110, type: 'Identifier' }],
          quasis: [
            { end: 108, start: 101, type: 'TemplateElement' },
            { end: 129, start: 129, type: 'TemplateElement' },
          ],
          start: 100,
          type: 'TemplateLiteral',
        },
        {
          quasis: [
            { range: [141, 141], type: 'TemplateElement' },
            { range: [159, 159], type: 'TemplateElement' },
          ],
          range: [140, 160],
          type: 'TSTemplateLiteralType',
          types: [{ range: [143, 151], type: 'TSStringKeyword' }],
        },
      ],
      type: 'Program',
    };

    expect(collectEmbeddedExpressionRanges(ast)).toEqual([
      { end: 30, start: 10 },
      { end: 60, start: 40 },
      { end: 90, start: 70 },
      { end: 129, start: 108 },
      { end: 159, start: 141 },
    ]);
  });
});

describe('isCommentInEmbeddedExpression', () => {
  it('detects a comment after a boundary on the same line', () => {
    const text = ['  <span>{value // long comment', '  }</span>'].join('\n');
    const comment = createCommentRange(text, '// long comment');
    const range = { end: text.indexOf('}') + 1, start: text.indexOf('{') };

    expect(isCommentInEmbeddedExpression(comment, [range])).toBe(true);
  });

  it('detects a comment when its line starts inside the embedded expression', () => {
    const text = ['  <span>{', '    value // long comment', '  }</span>'].join('\n');
    const comment = createCommentRange(text, '// long comment');
    const range = { end: text.indexOf('}') + 1, start: text.indexOf('{') };

    expect(isCommentInEmbeddedExpression(comment, [range])).toBe(true);
  });

  it('ignores comments outside embedded expressions', () => {
    const text = ['// outside', '<span>{value}</span>'].join('\n');
    const comment = createCommentRange(text, '// outside');
    const range = { end: text.indexOf('}') + 1, start: text.indexOf('{') };

    expect(isCommentInEmbeddedExpression(comment, [range])).toBe(false);
  });
});
