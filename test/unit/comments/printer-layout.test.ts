import { describe, expect, it } from 'vitest';

import { getPrinterLayout } from '../../../src/comments/printer-layout.js';
import { createCommentEntries } from '../support/comments.js';

describe('getPrinterLayout', () => {
  it('returns empty layout measurements without printer output', () => {
    expect(getPrinterLayout('// note', createCommentEntries('// note', ['// note']), [], undefined, 2)).toEqual({
      comments: [],
      jsxCommentMarkerColumns: [],
    });
  });

  it('measures the exact output line, marker, indentation, and suffix widths', () => {
    const text = 'const x = /* note */ + 1;';
    const entries = createCommentEntries(text, ['/* note */']);

    expect(
      getPrinterLayout(text, entries, [], { ast: { comments: entries.map((entry) => entry.raw) }, text }, 2),
    ).toEqual({
      comments: [
        {
          lineIndentColumn: 0,
          lineStart: 0,
          lineWidth: 25,
          markerColumn: 10,
          suffixWidth: 5,
        },
      ],
      jsxCommentMarkerColumns: [],
    });
  });

  it('aligns equal comment kinds by position even when printer text changes', () => {
    const text = '// original';
    const entries = createCommentEntries(text, ['// original']);
    const outputText = '    // reformatted';
    const outputEntries = createCommentEntries(outputText, ['// reformatted']);

    expect(
      getPrinterLayout(
        text,
        entries,
        [],
        { ast: { comments: outputEntries.map((entry) => entry.raw) }, text: outputText },
        2,
      ),
    ).toEqual({
      comments: [
        {
          lineIndentColumn: 4,
          lineStart: 0,
          lineWidth: 18,
          markerColumn: 4,
          suffixWidth: 0,
        },
      ],
      jsxCommentMarkerColumns: [],
    });
  });

  it('matches inserted output comments by kind and normalized raw text', () => {
    const text = [['/* first', ' * second */'].join('\r\n'), '// last'].join('\r\n');
    const entries = createCommentEntries(text, [['/* first', ' * second */'].join('\r\n'), '// last']);
    const outputText = ['// inserted', '/* first', ' * second */', '// last'].join('\n');
    const outputEntries = createCommentEntries(outputText, [
      '// inserted',
      ['/* first', ' * second */'].join('\n'),
      '// last',
    ]);

    expect(
      getPrinterLayout(
        text,
        entries,
        [],
        { ast: { comments: outputEntries.map((entry) => entry.raw) }, text: outputText },
        2,
      ),
    ).toEqual({
      comments: [
        {
          lineIndentColumn: 0,
          lineStart: 12,
          lineWidth: 20,
          markerColumn: 0,
          suffixWidth: 0,
        },
        {
          lineIndentColumn: 0,
          lineStart: 34,
          lineWidth: 7,
          markerColumn: 0,
          suffixWidth: 0,
        },
      ],
      jsxCommentMarkerColumns: [],
    });
  });

  it('marks source comments that have no matching output comment as missing', () => {
    const text = '// missing';
    const entries = createCommentEntries(text, ['// missing']);
    const outputText = '/* other */';
    const outputEntries = createCommentEntries(outputText, ['/* other */']);

    expect(
      getPrinterLayout(
        text,
        entries,
        [],
        { ast: { comments: outputEntries.map((entry) => entry.raw) }, text: outputText },
        2,
      ),
    ).toEqual({ comments: [undefined], jsxCommentMarkerColumns: [] });
  });

  it('collects JSX marker columns only when container counts align', () => {
    const outputText = ['<Component>', '  {/* note */}', '</Component>'].join('\n');
    const containerStart = outputText.indexOf('{');
    const containerEnd = outputText.indexOf('}') + 1;
    const outputAst = {
      body: [
        {
          end: containerEnd,
          expression: { end: containerEnd - 1, start: containerStart + 1, type: 'JSXEmptyExpression' },
          start: containerStart,
          type: 'JSXExpressionContainer',
        },
      ],
      type: 'Program',
    };
    const source = { ast: outputAst, text: outputText };
    const originalContainer = { end: 2, expression: undefined, start: 0 };

    expect(getPrinterLayout('', [], [originalContainer], source, 2)).toEqual({
      comments: [],
      jsxCommentMarkerColumns: [4],
    });
    expect(getPrinterLayout('', [], [originalContainer, originalContainer], source, 2)).toEqual({
      comments: [],
      jsxCommentMarkerColumns: [],
    });
  });
});
