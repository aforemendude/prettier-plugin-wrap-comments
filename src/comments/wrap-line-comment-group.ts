import { normalizeLineCommentBody } from './comment-body.js';
import type { CommentRange } from './comment-ranges.js';
import { getColumnAt } from '../utils/display-width.js';
import { formatMarkdownLines } from '../utils/format-markdown.js';
import { getContinuationIndent } from '../utils/indentation.js';
import type { Replacement } from '../utils/replacements.js';
import { getPreferredNewline } from '../utils/source-lines.js';
import { getAvailableContentWidth, getTabWidth } from '../utils/wrap-options.js';
import type { WrapOptions } from '../utils/wrap-options.js';

export async function wrapLineCommentGroup(
  text: string,
  comments: CommentRange[],
  options: WrapOptions,
  outputMarkerColumn?: number,
): Promise<Replacement | undefined> {
  const firstComment = comments[0];

  if (firstComment === undefined) {
    return undefined;
  }

  const lastComment = comments.at(-1) ?? firstComment;
  const bodyLines = comments.map((comment) => normalizeLineCommentBody(text.slice(comment.start + 2, comment.end)));

  if (bodyLines.every((line) => line.trim() === '')) {
    return undefined;
  }

  const tabWidth = getTabWidth(options);
  const markerColumn = outputMarkerColumn ?? getColumnAt(text, firstComment.start, tabWidth);
  const availableWidth = getAvailableContentWidth(options, markerColumn + 3);
  const formattedLines = await formatMarkdownLines(bodyLines.join('\n'), availableWidth, options);
  const newline = getPreferredNewline(text, options);
  const continuationIndent = getContinuationIndent(text, firstComment.start, markerColumn, options);
  const replacementText = formattedLines
    .map((line, index) => {
      const commentText = line.length === 0 ? '//' : `// ${line}`;

      return `${index === 0 ? '' : continuationIndent}${commentText}`;
    })
    .join(newline);
  const start = firstComment.start;
  const end = lastComment.end;

  if (replacementText === text.slice(start, end)) {
    return undefined;
  }

  return {
    end,
    start,
    text: replacementText,
  };
}
