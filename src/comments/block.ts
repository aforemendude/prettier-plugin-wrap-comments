import { isDirectiveComment, normalizeBlockCommentBody } from './core.js';
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

export async function wrapBlockComment(
  text: string,
  comment: CommentRange,
  options: WrapOptions,
): Promise<Replacement | undefined> {
  const raw = text.slice(comment.start, comment.end);

  if (raw.startsWith('/**')) {
    return undefined;
  }

  const markdown = normalizeBlockCommentBody(raw);

  if (markdown.trim() === '' || isDirectiveComment(markdown)) {
    return undefined;
  }

  const tabWidth = getTabWidth(options);
  const markerColumn = getColumnAt(text, comment.start, tabWidth);
  const availableWidth = getAvailableContentWidth(options, markerColumn + 3);
  const formattedLines = await formatMarkdownLines(markdown, availableWidth, options);
  const replacementText = buildBlockReplacement(text, comment, formattedLines, options);

  if (replacementText === undefined || replacementText === text.slice(comment.start, comment.end)) {
    return undefined;
  }

  return {
    end: comment.end,
    start: comment.start,
    text: replacementText,
  };
}

function buildBlockReplacement(
  text: string,
  comment: CommentRange,
  formattedLines: string[],
  options: WrapOptions,
): string | undefined {
  const tabWidth = getTabWidth(options);
  const markerColumn = getColumnAt(text, comment.start, tabWidth);
  const singleLine = `/* ${formattedLines.join(' ')} */`;
  const singleLineWidth = getColumns(singleLine, tabWidth);

  if (formattedLines.length === 1 && markerColumn + singleLineWidth <= getPrintWidth(options)) {
    return singleLine;
  }

  if (!isStandaloneBlockComment(text, comment)) {
    return undefined;
  }

  const newline = getPreferredNewline(text, options);
  const indent = getLinePrefix(text, comment.start);
  const body = formattedLines.map((line) => `${indent} *${line.length === 0 ? '' : ` ${line}`}`).join(newline);

  return `/*${newline}${body}${newline}${indent} */`;
}
