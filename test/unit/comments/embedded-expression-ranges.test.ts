import { describe, expect, it } from 'vitest';

import {
  collectEmbeddedExpressionRanges,
  getEmbeddedTrailingLineCommentMove,
  isCommentInEmbeddedExpression,
} from '../../../src/comments/embedded-expression-ranges.js';
import { createCommentRange } from '../support/comments.js';

describe('collectEmbeddedExpressionRanges', () => {
  it('collects JSX containers, JSX spreads, and template interpolations', () => {
    const ast = {
      body: [
        {
          end: 30,
          expression: { end: 20, start: 15, type: 'Identifier' },
          start: 10,
          type: 'JSXExpressionContainer',
        },
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
      { end: 30, expression: { end: 20, start: 15 }, start: 10 },
      { end: 60, start: 40 },
      { end: 90, start: 70 },
      { end: 129, expression: { end: 115, start: 110 }, start: 108 },
      { end: 159, expression: { end: 151, start: 143 }, start: 141 },
    ]);
  });
});

describe('getEmbeddedTrailingLineCommentMove', () => {
  it('moves a comment directly trailing the root expression to the expression start', () => {
    const text = ['<span>{value // long comment', '}</span>'].join('\n');
    const comment = createCommentRange(text, '// long comment');
    const expression = { end: text.indexOf('value') + 'value'.length, start: text.indexOf('value') };
    const range = { end: text.indexOf('}') + 1, expression, start: text.indexOf('{') };

    expect(getEmbeddedTrailingLineCommentMove(text, comment, [range])).toEqual({
      insertAt: expression.start,
      removeStart: expression.end,
    });
  });

  it('does not move nested, separated, or spread comments', () => {
    const nestedText = ['<span>{{ value: item, // nested comment', '}}</span>'].join('\n');
    const nestedComment = createCommentRange(nestedText, '// nested comment');
    const nestedRange = {
      end: nestedText.lastIndexOf('}') + 1,
      expression: {
        end: nestedText.lastIndexOf('}'),
        start: nestedText.indexOf('{', nestedText.indexOf('{') + 1),
      },
      start: nestedText.indexOf('{'),
    };
    const separatedText = ['<span>{value /* note */ // separated comment', '}</span>'].join('\n');
    const separatedComment = createCommentRange(separatedText, '// separated comment');
    const separatedRange = {
      end: separatedText.indexOf('}') + 1,
      expression: {
        end: separatedText.indexOf('value') + 'value'.length,
        start: separatedText.indexOf('value'),
      },
      start: separatedText.indexOf('{'),
    };
    const spreadText = ['<Component {...props // spread comment', '} />'].join('\n');
    const spreadComment = createCommentRange(spreadText, '// spread comment');
    const spreadRange = { end: spreadText.indexOf('}') + 1, start: spreadText.indexOf('{') };

    expect(getEmbeddedTrailingLineCommentMove(nestedText, nestedComment, [nestedRange])).toBeUndefined();
    expect(getEmbeddedTrailingLineCommentMove(separatedText, separatedComment, [separatedRange])).toBeUndefined();
    expect(getEmbeddedTrailingLineCommentMove(spreadText, spreadComment, [spreadRange])).toBeUndefined();
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
