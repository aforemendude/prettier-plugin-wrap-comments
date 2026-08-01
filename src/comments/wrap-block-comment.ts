import { normalizeBlockCommentBody } from './comment-body.js';
import { shouldSkipBlockComment } from './comment-eligibility.js';
import { isStandaloneBlockComment } from './comment-location.js';
import type { CommentRange } from './comment-ranges.js';
import { getColumnAt, getColumns } from '../utils/display-width.js';
import { formatMarkdownLines } from '../utils/format-markdown.js';
import type { Replacement } from '../utils/replacements.js';
import { getLinePrefix, getPreferredNewline } from '../utils/source-lines.js';
import { getAvailableContentWidth, getPrintWidth, getTabWidth } from '../utils/wrap-options.js';
import type { WrapOptions } from '../utils/wrap-options.js';

export type BlockCommentLayout = {
  contentColumn?: number;
  leadingMove?: {
    removeEnd: number;
    removeStart: number;
  };
  markerColumn?: number;
  multilineIndent?: string;
  placement: 'inline' | 'standalone' | 'trailing';
  singleLineSuffixWidth?: number;
  trailingMove?: {
    insertAt: number;
    removeEnd: number;
    removeStart: number;
  };
};

export async function wrapBlockComment(
  text: string,
  comment: CommentRange,
  options: WrapOptions,
  layout: BlockCommentLayout = getDefaultBlockCommentLayout(text, comment),
): Promise<Replacement | Replacement[] | undefined> {
  if (shouldSkipBlockComment(text, comment)) {
    return undefined;
  }

  const raw = text.slice(comment.start, comment.end);
  const markdown = normalizeBlockCommentBody(raw);

  const tabWidth = getTabWidth(options);
  const markerColumn = layout.markerColumn ?? getColumnAt(text, comment.start, tabWidth);
  const availableWidth = getAvailableContentWidth(options, layout.contentColumn ?? markerColumn + 3);
  const formattedLines = await formatMarkdownLines(markdown, availableWidth, options);
  const replacement = buildBlockReplacement(text, comment, formattedLines, options, layout);

  if (replacement === undefined) {
    return undefined;
  }

  if (Array.isArray(replacement)) {
    return replacement;
  }

  if (replacement === text.slice(comment.start, comment.end)) {
    return undefined;
  }

  return {
    end: comment.end,
    start: comment.start,
    text: replacement,
  };
}

function buildBlockReplacement(
  text: string,
  comment: CommentRange,
  formattedLines: string[],
  options: WrapOptions,
  layout: BlockCommentLayout,
): Replacement[] | string | undefined {
  const tabWidth = getTabWidth(options);
  const markerColumn = layout.markerColumn ?? getColumnAt(text, comment.start, tabWidth);
  const singleLine = `/* ${formattedLines.join(' ')} */`;
  const singleLineWidth = getColumns(singleLine, tabWidth);
  const singleLineSuffixWidth = layout.singleLineSuffixWidth ?? 0;

  if (formattedLines.length === 1 && markerColumn + singleLineWidth + singleLineSuffixWidth <= getPrintWidth(options)) {
    return singleLine;
  }

  if (layout.placement === 'inline') {
    return undefined;
  }

  const newline = getPreferredNewline(text, options);
  const indent = layout.multilineIndent ?? getLinePrefix(text, comment.start);
  const replacementText = buildMultilineBlockReplacement(formattedLines, newline, indent);
  const replacementTextWithNewline = [replacementText, ''].join(newline);

  if (layout.trailingMove !== undefined) {
    return [
      {
        end: layout.trailingMove.insertAt,
        start: layout.trailingMove.insertAt,
        text: replacementTextWithNewline,
      },
      {
        end: layout.trailingMove.removeEnd,
        start: layout.trailingMove.removeStart,
        text: '',
      },
    ];
  }

  if (layout.leadingMove !== undefined) {
    return [
      {
        end: comment.end,
        start: comment.start,
        text: replacementTextWithNewline,
      },
      {
        end: layout.leadingMove.removeEnd,
        start: layout.leadingMove.removeStart,
        text: '',
      },
    ];
  }

  return replacementText;
}

function buildMultilineBlockReplacement(formattedLines: string[], newline: string, indent: string): string {
  const body = formattedLines.map((line) => `${indent} *${line.length === 0 ? '' : ` ${line}`}`).join(newline);

  return ['/*', body, `${indent} */`].join(newline);
}

function getDefaultBlockCommentLayout(text: string, comment: CommentRange): BlockCommentLayout {
  return {
    placement: isStandaloneBlockComment(text, comment) ? 'standalone' : 'inline',
  };
}
