import { describe, expect, it } from 'vitest';

import {
  collectJsxExpressionContainerRanges,
  getJsxExpressionBlockCommentLayout,
  getPrintedJsxCommentMarkerColumn,
} from '../../../src/comments/jsx-expression-layout.js';
import type { JsxExpressionContainerRange } from '../../../src/comments/jsx-expression-layout.js';
import type { PrinterCommentLayout } from '../../../src/comments/printer-layout.js';
import { createCommentRange } from '../support/comments.js';

describe('collectJsxExpressionContainerRanges', () => {
  it('collects valid containers, classifies expressions, and sorts nested ranges', () => {
    const ast = {
      body: [
        {
          end: 30,
          expression: { end: 25, start: 22, type: 'Identifier' },
          start: 20,
          type: 'JSXExpressionContainer',
        },
        {
          expression: { end: 17, start: 6, type: 'JSXEmptyExpression' },
          range: [5, 18],
          type: 'JSXExpressionContainer',
        },
        {
          end: 20,
          expression: { range: [6, 19], type: 'Identifier' },
          start: 5,
          type: 'JSXExpressionContainer',
        },
        {
          end: 40,
          expression: { end: 39, start: 31, type: 'Identifier' },
          start: 40,
          type: 'JSXExpressionContainer',
        },
      ],
      end: 50,
      start: 0,
      type: 'Program',
    };

    expect(collectJsxExpressionContainerRanges(ast)).toEqual([
      { end: 20, expression: { end: 19, start: 6 }, start: 5 },
      { end: 18, expression: undefined, start: 5 },
      { end: 30, expression: { end: 25, start: 22 }, start: 20 },
    ]);
  });
});

describe('getPrintedJsxCommentMarkerColumn', () => {
  it('adds one indentation level to the containing line indentation', () => {
    const text = '\t<Component>{value}</Component>';
    const start = text.indexOf('{');

    expect(getPrintedJsxCommentMarkerColumn(text, { end: text.indexOf('}') + 1, start }, 4)).toBe(8);
  });
});

describe('getJsxExpressionBlockCommentLayout', () => {
  it('returns undefined when no braced container encloses the comment', () => {
    const text = '(/* note */)';
    const comment = createCommentRange(text, '/* note */');
    const container = { end: text.length, expression: undefined, start: 0 };

    expect(
      getJsxExpressionBlockCommentLayout(text, comment, undefined, createContainerMatch(container), 2, undefined, []),
    ).toBeUndefined();
  });

  it('lays out a comment-only expression container as standalone', () => {
    const text = '{/* note */}';
    const comment = createCommentRange(text, '/* note */');
    const container = { end: text.length, expression: undefined, start: 0 };

    expect(
      getJsxExpressionBlockCommentLayout(text, comment, undefined, createContainerMatch(container), 2, undefined, []),
    ).toEqual({
      contentColumn: 5,
      markerColumn: 2,
      multilineIndent: '',
      placement: 'standalone',
      singleLineSuffixWidth: 1,
    });
  });

  it('uses the matched container index and printer-provided marker measurements', () => {
    const text = '{{/* note */}}';
    const comment = createCommentRange(text, '/* note */');
    const innerContainer: JsxExpressionContainerRange = {
      end: text.length - 1,
      expression: undefined,
      start: 1,
    };
    const outputLayout: PrinterCommentLayout = {
      lineIndentColumn: 0,
      lineWidth: 20,
      markerColumn: 10,
      suffixWidth: 3,
    };

    expect(
      getJsxExpressionBlockCommentLayout(
        text,
        comment,
        undefined,
        createContainerMatch(innerContainer, 1),
        2,
        outputLayout,
        [8, 4],
      ),
    ).toEqual({
      contentColumn: 7,
      markerColumn: 10,
      multilineIndent: '',
      placement: 'standalone',
      singleLineSuffixWidth: 3,
    });
  });

  it('returns an exact trailing move for a comment after an expression', () => {
    const text = '{value /* note */}';
    const comment = createCommentRange(text, '/* note */');
    const expressionStart = text.indexOf('value');
    const container = {
      end: text.length,
      expression: { end: expressionStart + 'value'.length, start: expressionStart },
      start: 0,
    };

    expect(
      getJsxExpressionBlockCommentLayout(text, comment, undefined, createContainerMatch(container), 2, undefined, []),
    ).toEqual({
      contentColumn: 5,
      markerColumn: 2,
      multilineIndent: '',
      placement: 'trailing',
      singleLineSuffixWidth: 1,
      trailingMove: {
        insertAt: expressionStart,
        removeEnd: comment.end,
        removeStart: expressionStart + 'value'.length,
      },
    });
  });

  it('keeps later trailing comments standalone to preserve their source order', () => {
    const text = '{value /* first */ /* second */}';
    const previousComment = createCommentRange(text, '/* first */');
    const comment = createCommentRange(text, '/* second */');
    const expressionStart = text.indexOf('value');
    const container = {
      end: text.length,
      expression: { end: expressionStart + 'value'.length, start: expressionStart },
      start: 0,
    };

    expect(
      getJsxExpressionBlockCommentLayout(
        text,
        comment,
        previousComment,
        createContainerMatch(container),
        2,
        undefined,
        [],
      ),
    ).toEqual({
      contentColumn: 5,
      markerColumn: 2,
      multilineIndent: '',
      placement: 'standalone',
      singleLineSuffixWidth: 1,
    });
  });

  it('returns an exact leading move for an inline comment before an expression', () => {
    const text = '{/* note */ value}';
    const comment = createCommentRange(text, '/* note */');
    const expressionStart = text.indexOf('value');
    const container = {
      end: text.length,
      expression: { end: expressionStart + 'value'.length, start: expressionStart },
      start: 0,
    };

    expect(
      getJsxExpressionBlockCommentLayout(text, comment, undefined, createContainerMatch(container), 2, undefined, []),
    ).toEqual({
      contentColumn: 5,
      leadingMove: { removeEnd: expressionStart, removeStart: comment.end },
      markerColumn: 2,
      multilineIndent: '',
      placement: 'standalone',
      singleLineSuffixWidth: 7,
    });
  });

  it('lays out an already-standalone leading comment without moving it', () => {
    const leadingText = ['{', '  /* note */', '  value', '}'].join('\n');
    const leadingComment = createCommentRange(leadingText, '/* note */');
    const valueStart = leadingText.indexOf('value');
    const leadingContainer = {
      end: leadingText.length,
      expression: { end: valueStart + 'value'.length, start: valueStart },
      start: 0,
    };

    expect(
      getJsxExpressionBlockCommentLayout(
        leadingText,
        leadingComment,
        undefined,
        createContainerMatch(leadingContainer),
        2,
        undefined,
        [],
      ),
    ).toEqual({
      contentColumn: 5,
      markerColumn: 2,
      multilineIndent: '',
      placement: 'standalone',
      preserveMultiline: false,
      singleLineSuffixWidth: 0,
    });
  });

  it('leaves expression-surrounded comments inline', () => {
    const surroundedText = '{left /* note */ right}';
    const surroundedComment = createCommentRange(surroundedText, '/* note */');
    const surroundedContainer = {
      end: surroundedText.length,
      expression: { end: surroundedText.length - 1, start: 1 },
      start: 0,
    };

    expect(
      getJsxExpressionBlockCommentLayout(
        surroundedText,
        surroundedComment,
        undefined,
        createContainerMatch(surroundedContainer),
        2,
        undefined,
        [],
      ),
    ).toEqual({ placement: 'inline' });
  });
});

function createContainerMatch(
  range: JsxExpressionContainerRange,
  index = 0,
): { index: number; range: JsxExpressionContainerRange } {
  return { index, range };
}
