import { collectCommentEntries } from './comment-ranges.js';
import type { CommentEntry, CommentRange } from './comment-ranges.js';
import { collectJsxExpressionContainerRanges, getPrintedJsxCommentMarkerColumn } from './jsx-expression-layout.js';
import type { JsxExpressionContainerRange } from './jsx-expression-layout.js';
import { getColumns } from '../utils/display-width.js';
import { getLeadingIndent } from '../utils/indentation.js';
import { getLineEnd, getLineStart } from '../utils/source-lines.js';

export type PrinterLayoutSource = {
  ast: unknown;
  text: string;
};

export type PrinterCommentLayout = {
  lineIndentColumn: number;
  lineStart: number;
  lineWidth: number;
  markerColumn: number;
  suffixWidth: number;
};

export type PrinterLayout = {
  comments: Array<PrinterCommentLayout | undefined>;
  jsxCommentMarkerColumns: Array<number | undefined>;
};

export function getPrinterLayout(
  text: string,
  commentEntries: CommentEntry[],
  jsxExpressionContainers: JsxExpressionContainerRange[],
  source: PrinterLayoutSource | undefined,
  tabWidth: number,
): PrinterLayout {
  if (source === undefined) {
    return {
      comments: [],
      jsxCommentMarkerColumns: [],
    };
  }

  const outputCommentEntries = collectCommentEntries(source.ast, source.text);
  const alignedOutputComments = alignOutputComments(text, commentEntries, source.text, outputCommentEntries);
  const outputJsxExpressionContainers = collectJsxExpressionContainerRanges(source.ast);
  const jsxCommentMarkerColumns =
    outputJsxExpressionContainers.length === jsxExpressionContainers.length
      ? outputJsxExpressionContainers.map((container) =>
          getPrintedJsxCommentMarkerColumn(source.text, container, tabWidth),
        )
      : [];

  return {
    comments: alignedOutputComments.map((comment) =>
      comment === undefined ? undefined : getPrinterCommentLayout(source.text, comment.range, tabWidth),
    ),
    jsxCommentMarkerColumns,
  };
}

function alignOutputComments(
  text: string,
  comments: CommentEntry[],
  outputText: string,
  outputComments: CommentEntry[],
): Array<CommentEntry | undefined> {
  if (
    comments.length === outputComments.length &&
    comments.every((comment, index) => comment.range.kind === outputComments[index]?.range.kind)
  ) {
    return outputComments;
  }

  const alignedComments: Array<CommentEntry | undefined> = [];
  let outputIndex = 0;

  for (const comment of comments) {
    const raw = normalizeCommentForMatching(text.slice(comment.range.start, comment.range.end));
    let matchingComment: CommentEntry | undefined;

    while (outputIndex < outputComments.length) {
      const candidate = outputComments[outputIndex];
      outputIndex += 1;

      if (
        candidate !== undefined &&
        candidate.range.kind === comment.range.kind &&
        normalizeCommentForMatching(outputText.slice(candidate.range.start, candidate.range.end)) === raw
      ) {
        matchingComment = candidate;
        break;
      }
    }

    alignedComments.push(matchingComment);
  }

  return alignedComments;
}

function normalizeCommentForMatching(raw: string): string {
  return raw.replace(/\r\n?/gu, '\n');
}

function getPrinterCommentLayout(text: string, comment: CommentRange, tabWidth: number): PrinterCommentLayout {
  const lineStart = getLineStart(text, comment.start);
  const lineEnd = getLineEnd(text, comment.end);
  const linePrefix = text.slice(lineStart, comment.start);
  const lineIndent = getLeadingIndent(linePrefix);
  const lineText = text.slice(lineStart, lineEnd).replace(/[ \t]+$/u, '');
  const suffix = text.slice(comment.end, lineEnd).replace(/[ \t]+$/u, '');

  return {
    lineIndentColumn: getColumns(lineIndent, tabWidth),
    lineStart,
    lineWidth: getColumns(lineText, tabWidth),
    markerColumn: getColumns(linePrefix, tabWidth),
    suffixWidth: getColumns(suffix, tabWidth),
  };
}
