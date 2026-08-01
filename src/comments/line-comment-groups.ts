import { shouldSkipLineComment } from './comment-eligibility.js';
import { areCommentsOnAdjacentLines, isStandaloneLineComment } from './comment-location.js';
import type { CommentRange } from './comment-ranges.js';
import { getColumnAt } from '../utils/display-width.js';

export type LineCommentGroup = {
  comments: CommentRange[];
  endIndex: number;
};

export function collectLineCommentGroup(
  text: string,
  comments: CommentRange[],
  startIndex: number,
  tabWidth: number,
): LineCommentGroup {
  const firstComment = comments[startIndex];

  if (firstComment === undefined) {
    return { comments: [], endIndex: startIndex };
  }

  const group = [firstComment];
  const markerColumn = getColumnAt(text, firstComment.start, tabWidth);
  let endIndex = startIndex;
  let previousComment = firstComment;

  while (endIndex + 1 < comments.length) {
    const nextComment = comments[endIndex + 1];

    if (
      nextComment === undefined ||
      nextComment.kind !== 'line' ||
      !isStandaloneLineComment(text, nextComment) ||
      shouldSkipLineComment(text, nextComment) ||
      !areCommentsOnAdjacentLines(text, previousComment, nextComment) ||
      markerColumn !== getColumnAt(text, nextComment.start, tabWidth)
    ) {
      break;
    }

    group.push(nextComment);
    previousComment = nextComment;
    endIndex += 1;
  }

  return { comments: group, endIndex };
}
