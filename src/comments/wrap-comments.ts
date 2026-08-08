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
import type { PrinterLayoutSource } from './printer-layout.js';
import { wrapBlockComment } from './wrap-block-comment.js';
import { wrapLineCommentGroup } from './wrap-line-comment-group.js';
import { wrapTrailingLineComment } from './wrap-trailing-line-comment.js';
import { matchOrderedRangesToSmallestContainers } from '../utils/ast.js';
import { applyReplacements } from '../utils/replacements.js';
import type { Replacement } from '../utils/replacements.js';
import type { JsxBlockCommentRewrite } from '../plugin/jsx-comment-rewrite-metadata.js';
import { getTabWidth } from '../utils/wrap-options.js';
import type { WrapOptions } from '../utils/wrap-options.js';

export type WrapCommentsResult = {
  jsxBlockCommentRewrites: JsxBlockCommentRewrite[];
  text: string;
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

      const replacement = await wrapTrailingLineComment(text, comment, options, outputCommentLayout, embeddedMove);

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
