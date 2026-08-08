import { shouldSkipLineComment } from './comment-eligibility.js';
import { isStandaloneBlockComment, isStandaloneLineComment } from './comment-location.js';
import { collectCommentEntries } from './comment-ranges.js';
import {
  collectEmbeddedExpressionRanges,
  doesBlockCommentSeparateEmbeddedTrailingLineComment,
  getEmbeddedTrailingLineCommentMove,
} from './embedded-expression-ranges.js';
import { collectJsxExpressionContainerRanges, getJsxExpressionBlockCommentLayout } from './jsx-expression-layout.js';
import { collectLineCommentGroup } from './line-comment-groups.js';
import {
  collectPrettierIgnoredLineRanges,
  isCommentInIgnoredLineRange,
  isPrettierIgnoredBlockComment,
  isPrettierIgnoredStandaloneLineComment,
  isPrettierIgnoredTrailingLineComment,
} from './prettier-ignore.js';
import { getPrinterLayout } from './printer-layout.js';
import type { PrinterCommentLayout, PrinterLayoutSource } from './printer-layout.js';
import { wrapBlockComment } from './wrap-block-comment.js';
import { wrapLineCommentGroup } from './wrap-line-comment-group.js';
import { wrapTrailingLineComment } from './wrap-trailing-line-comment.js';
import type { TrailingLineCommentLayout } from './wrap-trailing-line-comment.js';
import { matchOrderedRangesToSmallestContainers } from '../utils/ast.js';
import { getColumnAt, getColumns } from '../utils/display-width.js';
import { applyReplacements } from '../utils/replacements.js';
import type { Replacement } from '../utils/replacements.js';
import { getLineEnd, getLineStart } from '../utils/source-lines.js';
import type { JsxBlockCommentRewrite } from '../plugin/jsx-comment-rewrite-metadata.js';
import { getTabWidth } from '../utils/wrap-options.js';
import type { WrapOptions } from '../utils/wrap-options.js';

export type WrapCommentsResult = {
  jsxBlockCommentRewrites: JsxBlockCommentRewrite[];
  text: string;
};

type SameLineWidthDeltas = {
  output: Map<number, number>;
  source: Map<number, number>;
};

export async function wrapComments<T>(
  text: string,
  ast: T,
  options: WrapOptions,
  printerLayoutSource?: PrinterLayoutSource,
): Promise<string> {
  return (await wrapCommentsWithMetadata(text, ast, options, printerLayoutSource)).text;
}

export async function wrapCommentsWithMetadata<T>(
  text: string,
  ast: T,
  options: WrapOptions,
  printerLayoutSource?: PrinterLayoutSource,
): Promise<WrapCommentsResult> {
  const commentEntries = collectCommentEntries(ast, text);
  const comments = commentEntries.map((entry) => entry.range);
  const embeddedExpressionRanges = collectEmbeddedExpressionRanges(ast);
  const jsxExpressionContainers = collectJsxExpressionContainerRanges(ast);
  const ignoredLineRanges = collectPrettierIgnoredLineRanges(text, ast, commentEntries);
  const embeddedExpressionRangeMatches = matchOrderedRangesToSmallestContainers(comments, embeddedExpressionRanges);
  const jsxExpressionContainerMatches = matchOrderedRangesToSmallestContainers(comments, jsxExpressionContainers);

  if (comments.length === 0) {
    return { jsxBlockCommentRewrites: [], text };
  }

  const replacements: Replacement[] = [];
  const jsxBlockCommentRewrites: JsxBlockCommentRewrite[] = [];
  const tabWidth = getTabWidth(options);
  const printerLayout = getPrinterLayout(text, commentEntries, jsxExpressionContainers, printerLayoutSource, tabWidth);
  // Replacements are applied after traversal, so retain pending width changes in both layout coordinate spaces.
  const sameLineWidthDeltas: SameLineWidthDeltas = {
    output: new Map(),
    source: new Map(),
  };
  let blockCommentIndex = -1;
  let ignoredLineRangeIndex = 0;

  for (let index = 0; index < comments.length; index += 1) {
    const comment = comments[index];
    const outputCommentLayout = printerLayout.comments[index];

    if (comment?.kind === 'block') {
      blockCommentIndex += 1;
    }

    if (comment === undefined) {
      continue;
    }

    let ignoredLineRange = ignoredLineRanges[ignoredLineRangeIndex];

    while (ignoredLineRange !== undefined && ignoredLineRange.end <= comment.start) {
      ignoredLineRangeIndex += 1;
      ignoredLineRange = ignoredLineRanges[ignoredLineRangeIndex];
    }

    if (isCommentInIgnoredLineRange(comment, ignoredLineRange)) {
      continue;
    }

    if (comment.kind === 'block') {
      if (isPrettierIgnoredBlockComment(text, commentEntries, index)) {
        continue;
      }

      const jsxLayout = getJsxExpressionBlockCommentLayout(
        text,
        comment,
        comments[index - 1],
        jsxExpressionContainerMatches[index],
        tabWidth,
        outputCommentLayout,
        printerLayout.jsxCommentMarkerColumns,
      );

      if (jsxLayout?.placement === 'inline') {
        continue;
      }

      const outputLayout =
        outputCommentLayout === undefined
          ? undefined
          : {
              markerColumn: outputCommentLayout.markerColumn,
              placement: isStandaloneBlockComment(text, comment) ? ('standalone' as const) : ('inline' as const),
            };
      const replacement = await wrapBlockComment(text, comment, options, jsxLayout ?? outputLayout);
      const preservesEmbeddedCommentOrder = doesBlockCommentSeparateEmbeddedTrailingLineComment(
        text,
        comment,
        comments[index + 1],
        embeddedExpressionRangeMatches[index]?.range,
        embeddedExpressionRangeMatches[index + 1]?.range,
      );

      if (Array.isArray(replacement)) {
        // Moving the block would make the line comment directly trail the expression on the next formatting pass.
        if (!preservesEmbeddedCommentOrder) {
          replacements.push(...replacement);
        }
      } else if (replacement !== undefined) {
        replacements.push(replacement);
        recordSameLineReplacementWidthDelta(
          text,
          comment,
          replacement,
          outputCommentLayout,
          tabWidth,
          sameLineWidthDeltas,
        );

        if (jsxLayout !== undefined) {
          jsxBlockCommentRewrites.push({ blockCommentIndex, text: replacement.text });
        }
      }

      continue;
    }

    if (shouldSkipLineComment(text, comment)) {
      continue;
    }

    if (isPrettierIgnoredStandaloneLineComment(text, commentEntries, index)) {
      index = collectLineCommentGroup(text, comments, index, tabWidth).endIndex;
      continue;
    }

    if (!isStandaloneLineComment(text, comment)) {
      if (isPrettierIgnoredTrailingLineComment(text, commentEntries, index)) {
        continue;
      }

      const embeddedExpressionRange = embeddedExpressionRangeMatches[index]?.range;
      const embeddedMove = getEmbeddedTrailingLineCommentMove(text, comment, embeddedExpressionRange);

      if (embeddedMove === undefined && embeddedExpressionRange !== undefined) {
        continue;
      }

      const trailingLayout = getTrailingLineCommentLayout(
        text,
        comment,
        outputCommentLayout,
        tabWidth,
        sameLineWidthDeltas,
      );
      const replacement = await wrapTrailingLineComment(text, comment, options, trailingLayout, embeddedMove);

      if (replacement !== undefined) {
        replacements.push(...replacement);
      }

      continue;
    }

    const group = collectLineCommentGroup(text, comments, index, tabWidth);
    index = group.endIndex;

    const replacement = await wrapLineCommentGroup(text, group.comments, options, outputCommentLayout?.markerColumn);

    if (replacement !== undefined) {
      replacements.push(replacement);
    }
  }

  return {
    jsxBlockCommentRewrites,
    text: applyReplacements(text, replacements),
  };
}

function recordSameLineReplacementWidthDelta(
  text: string,
  comment: { end: number; start: number },
  replacement: Replacement,
  outputLayout: PrinterCommentLayout | undefined,
  tabWidth: number,
  sameLineWidthDeltas: SameLineWidthDeltas,
): void {
  const original = text.slice(comment.start, comment.end);

  if (containsLineTerminator(original) || containsLineTerminator(replacement.text)) {
    return;
  }

  const sourceLineStart = getLineStart(text, comment.start);
  const sourceWidthDelta = sameLineWidthDeltas.source.get(sourceLineStart) ?? 0;
  const sourceMarkerColumn = getColumnAt(text, comment.start, tabWidth) + sourceWidthDelta;
  const sourceReplacementWidthDelta = getReplacementWidthDelta(
    original,
    replacement.text,
    sourceMarkerColumn,
    tabWidth,
  );

  addLineWidthDelta(sameLineWidthDeltas.source, sourceLineStart, sourceReplacementWidthDelta);

  if (outputLayout === undefined) {
    return;
  }

  const outputWidthDelta = sameLineWidthDeltas.output.get(outputLayout.lineStart) ?? 0;
  const outputMarkerColumn = outputLayout.markerColumn + outputWidthDelta;
  const outputReplacementWidthDelta = getReplacementWidthDelta(
    original,
    replacement.text,
    outputMarkerColumn,
    tabWidth,
  );

  addLineWidthDelta(sameLineWidthDeltas.output, outputLayout.lineStart, outputReplacementWidthDelta);
}

function getTrailingLineCommentLayout(
  text: string,
  comment: { start: number },
  outputLayout: PrinterCommentLayout | undefined,
  tabWidth: number,
  sameLineWidthDeltas: SameLineWidthDeltas,
): TrailingLineCommentLayout | undefined {
  if (outputLayout !== undefined) {
    const lineWidthDelta = sameLineWidthDeltas.output.get(outputLayout.lineStart) ?? 0;

    return lineWidthDelta === 0
      ? outputLayout
      : { ...outputLayout, lineWidth: outputLayout.lineWidth + lineWidthDelta };
  }

  const lineStart = getLineStart(text, comment.start);
  const lineWidthDelta = sameLineWidthDeltas.source.get(lineStart) ?? 0;

  if (lineWidthDelta === 0) {
    return undefined;
  }

  const lineEnd = getLineEnd(text, comment.start);
  const lineText = text.slice(lineStart, lineEnd).replace(/[ \t]+$/u, '');

  return { lineWidth: getColumns(lineText, tabWidth) + lineWidthDelta };
}

function getReplacementWidthDelta(
  original: string,
  replacement: string,
  markerColumn: number,
  tabWidth: number,
): number {
  const originalWidth = getColumns(original, tabWidth, markerColumn);
  const replacementWidth = getColumns(replacement, tabWidth, markerColumn);

  return replacementWidth - originalWidth;
}

function addLineWidthDelta(lineWidthDeltas: Map<number, number>, lineStart: number, delta: number): void {
  if (delta !== 0) {
    lineWidthDeltas.set(lineStart, (lineWidthDeltas.get(lineStart) ?? 0) + delta);
  }
}

function containsLineTerminator(text: string): boolean {
  return /[\r\n\u2028\u2029]/u.test(text);
}
