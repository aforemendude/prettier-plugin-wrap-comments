import { hasPreserveCommentMarker, isDirectiveComment, normalizeBlockCommentBody } from './core.js';
import { formatMarkdownLines } from '../shared/markdown.js';
import { getAvailableContentWidth, getPrintWidth, getTabWidth } from '../shared/options.js';
import {
  getColumnAt,
  getColumns,
  getLinePrefix,
  getPreferredNewline,
  isStandaloneBlockComment,
} from '../shared/text.js';
import type { CommentRange, Replacement, WrapOptions } from '../shared/types.js';

export type BlockCommentLayout = {
  contentColumn?: number;
  multilineIndent?: string;
  placement: 'inline' | 'standalone' | 'trailing';
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
  const raw = text.slice(comment.start, comment.end);

  if (raw.startsWith('/**') || hasPreserveCommentMarker(raw)) {
    return undefined;
  }

  const markdown = normalizeBlockCommentBody(raw);

  if (markdown.trim() === '' || isDirectiveComment(markdown)) {
    return undefined;
  }

  const tabWidth = getTabWidth(options);
  const markerColumn = getColumnAt(text, comment.start, tabWidth);
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
  const markerColumn = getColumnAt(text, comment.start, tabWidth);
  const singleLine = `/* ${formattedLines.join(' ')} */`;
  const singleLineWidth = getColumns(singleLine, tabWidth);

  if (formattedLines.length === 1 && markerColumn + singleLineWidth <= getPrintWidth(options)) {
    return singleLine;
  }

  if (layout.placement === 'inline') {
    return undefined;
  }

  const newline = getPreferredNewline(text, options);
  const indent = layout.multilineIndent ?? getLinePrefix(text, comment.start);
  const replacementText = buildMultilineBlockReplacement(formattedLines, newline, indent);

  if (layout.trailingMove !== undefined) {
    return [
      {
        end: layout.trailingMove.insertAt,
        start: layout.trailingMove.insertAt,
        text: `${replacementText}${newline}`,
      },
      {
        end: layout.trailingMove.removeEnd,
        start: layout.trailingMove.removeStart,
        text: '',
      },
    ];
  }

  return replacementText;
}

function buildMultilineBlockReplacement(formattedLines: string[], newline: string, indent: string): string {
  const body = formattedLines.map((line) => `${indent} *${line.length === 0 ? '' : ` ${line}`}`).join(newline);

  return `/*${newline}${body}${newline}${indent} */`;
}

function getDefaultBlockCommentLayout(text: string, comment: CommentRange): BlockCommentLayout {
  return {
    placement: isStandaloneBlockComment(text, comment) ? 'standalone' : 'inline',
  };
}
