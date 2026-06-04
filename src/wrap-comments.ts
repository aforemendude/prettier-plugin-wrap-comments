import { wrapBlockComment } from './block-comments.js';
import { collectComments, toCommentRange } from './comments.js';
import {
  areAdjacentLineComments,
  isStandaloneLineComment,
  shouldSkipLineComment,
  wrapLineCommentGroup,
} from './line-comments.js';
import { getTabWidth } from './options.js';
import { applyReplacements, getColumnAt } from './text.js';
import type { CommentRange, Replacement, WrapOptions } from './types.js';

export async function wrapComments<T>(text: string, ast: T, options: WrapOptions): Promise<string> {
  const comments = collectComments(ast)
    .map((comment) => toCommentRange(comment, text))
    .filter((comment): comment is CommentRange => comment !== undefined)
    .sort((left, right) => left.start - right.start);

  if (comments.length === 0) {
    return text;
  }

  const replacements: Replacement[] = [];
  const tabWidth = getTabWidth(options);

  for (let index = 0; index < comments.length; index += 1) {
    const comment = comments[index];

    if (comment === undefined) {
      continue;
    }

    if (comment.kind === 'block') {
      const replacement = await wrapBlockComment(text, comment, options);

      if (replacement !== undefined) {
        replacements.push(replacement);
      }

      continue;
    }

    if (!isStandaloneLineComment(text, comment) || shouldSkipLineComment(text, comment)) {
      continue;
    }

    const group = [comment];
    let previousComment = comment;

    while (index + 1 < comments.length) {
      const nextComment = comments[index + 1];

      if (nextComment === undefined) {
        break;
      }

      if (
        nextComment.kind !== 'line' ||
        !isStandaloneLineComment(text, nextComment) ||
        shouldSkipLineComment(text, nextComment) ||
        !areAdjacentLineComments(text, previousComment, nextComment) ||
        getColumnAt(text, comment.start, tabWidth) !== getColumnAt(text, nextComment.start, tabWidth)
      ) {
        break;
      }

      group.push(nextComment);
      previousComment = nextComment;
      index += 1;
    }

    const replacement = await wrapLineCommentGroup(text, group, options);

    if (replacement !== undefined) {
      replacements.push(replacement);
    }
  }

  return applyReplacements(text, replacements);
}
