import { isDirectiveComment, normalizeLineCommentBody } from "./comments.js";
import { formatMarkdownLines } from "./markdown.js";
import { getAvailableContentWidth, getTabWidth } from "./options.js";
import {
  getColumnAt,
  getContinuationIndent,
  getLinePrefix,
  getPreferredNewline,
} from "./text.js";
import type { CommentRange, Replacement, WrapOptions } from "./types.js";

export async function wrapLineCommentGroup(
  text: string,
  comments: CommentRange[],
  options: WrapOptions,
): Promise<Replacement | undefined> {
  const bodyLines = comments.map((comment) =>
    normalizeLineCommentBody(text.slice(comment.start + 2, comment.end)),
  );

  if (bodyLines.every((line) => line.trim() === "")) {
    return undefined;
  }

  const tabWidth = getTabWidth(options);
  const markerColumn = getColumnAt(text, comments[0].start, tabWidth);
  const availableWidth = getAvailableContentWidth(options, markerColumn + 3);
  const formattedLines = await formatMarkdownLines(
    bodyLines.join("\n"),
    availableWidth,
    options,
  );
  const newline = getPreferredNewline(text, options);
  const continuationIndent = getContinuationIndent(
    text,
    comments[0].start,
    markerColumn,
    options,
  );
  const replacementText = formattedLines
    .map((line, index) => {
      const commentText = line.length === 0 ? "//" : `// ${line}`;

      return index === 0
        ? commentText
        : `${newline}${continuationIndent}${commentText}`;
    })
    .join("");
  const start = comments[0].start;
  const end = comments[comments.length - 1].end;

  if (replacementText === text.slice(start, end)) {
    return undefined;
  }

  return {
    end,
    start,
    text: replacementText,
  };
}

export function shouldSkipLineComment(
  text: string,
  comment: CommentRange,
): boolean {
  const raw = text.slice(comment.start, comment.end);

  if (raw.startsWith("///")) {
    return true;
  }

  return isDirectiveComment(normalizeLineCommentBody(raw.slice(2)));
}

export function isStandaloneLineComment(
  text: string,
  comment: CommentRange,
): boolean {
  return /^[ \t]*$/u.test(getLinePrefix(text, comment.start));
}

export function areAdjacentLineComments(
  text: string,
  previous: CommentRange,
  next: CommentRange,
): boolean {
  return /^(?:\r\n|\n|\r)[ \t]*$/u.test(text.slice(previous.end, next.start));
}
