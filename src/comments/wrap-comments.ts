import { shouldSkipLineComment } from './comment-eligibility.js';
import { isStandaloneBlockComment, isStandaloneLineComment } from './comment-location.js';
import { collectCommentEntries } from './comment-ranges.js';
import { collectEmbeddedExpressionRanges, isCommentInEmbeddedExpression } from './embedded-expression-ranges.js';
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
import { applyReplacements } from '../utils/replacements.js';
import type { Replacement } from '../utils/replacements.js';
import { getTabWidth } from '../utils/wrap-options.js';
import type { WrapOptions } from '../utils/wrap-options.js';

export async function wrapComments<T>(
  text: string,
  ast: T,
  options: WrapOptions,
  printerLayoutSource?: PrinterLayoutSource,
): Promise<string> {
  const commentEntries = collectCommentEntries(ast, text);
  const comments = commentEntries.map((entry) => entry.range);
  const embeddedExpressionRanges = collectEmbeddedExpressionRanges(ast);
  const jsxExpressionContainers = collectJsxExpressionContainerRanges(ast);
  const ignoredLineRanges = collectPrettierIgnoredLineRanges(text, ast, commentEntries);

  if (comments.length === 0) {
    return text;
  }

  const replacements: Replacement[] = [];
  const tabWidth = getTabWidth(options);
  const printerLayout = getPrinterLayout(text, commentEntries, jsxExpressionContainers, printerLayoutSource, tabWidth);

  for (let index = 0; index < comments.length; index += 1) {
    const comment = comments[index];
    const outputCommentLayout = printerLayout.comments[index];

    if (comment === undefined || isCommentInIgnoredLineRange(comment, ignoredLineRanges)) {
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
        jsxExpressionContainers,
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

      if (Array.isArray(replacement)) {
        replacements.push(...replacement);
      } else if (replacement !== undefined) {
        replacements.push(replacement);
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

      if (isCommentInEmbeddedExpression(comment, embeddedExpressionRanges)) {
        continue;
      }

      const replacement = await wrapTrailingLineComment(text, comment, options, outputCommentLayout);

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

  return applyReplacements(text, replacements);
}
