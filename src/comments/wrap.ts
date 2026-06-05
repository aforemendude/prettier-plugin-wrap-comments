import { wrapBlockComment } from './block.js';
import {
  collectComments,
  isPrettierIgnoreComment,
  normalizeBlockCommentBody,
  normalizeLineCommentBody,
  toCommentRange,
} from './core.js';
import {
  areAdjacentLineComments,
  isStandaloneLineComment,
  shouldSkipLineComment,
  wrapLineCommentGroup,
  wrapTrailingLineComment,
} from './line.js';
import { getTabWidth } from '../shared/options.js';
import { applyReplacements, getColumnAt, isStandaloneBlockComment } from '../shared/text.js';
import type { CommentRange, Replacement, WrapOptions } from '../shared/types.js';

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
      if (isPrettierIgnoredBlockComment(text, comments, index)) {
        continue;
      }

      const replacement = await wrapBlockComment(text, comment, options);

      if (replacement !== undefined) {
        replacements.push(replacement);
      }

      continue;
    }

    if (shouldSkipLineComment(text, comment)) {
      continue;
    }

    if (!isStandaloneLineComment(text, comment)) {
      const replacement = await wrapTrailingLineComment(text, comment, options);

      if (replacement !== undefined) {
        replacements.push(replacement);
      }

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

function isPrettierIgnoredBlockComment(text: string, comments: CommentRange[], index: number): boolean {
  const comment = comments[index];
  const previousComment = comments[index - 1];

  if (comment === undefined || comment.kind !== 'block' || previousComment === undefined) {
    return false;
  }

  if (!isStandaloneComment(text, previousComment) || !isAdjacentPreviousComment(text, previousComment, comment)) {
    return false;
  }

  return isPrettierIgnoreComment(getCommentBody(text, previousComment));
}

function isStandaloneComment(text: string, comment: CommentRange): boolean {
  return comment.kind === 'line' ? isStandaloneLineComment(text, comment) : isStandaloneBlockComment(text, comment);
}

function isAdjacentPreviousComment(text: string, previousComment: CommentRange, comment: CommentRange): boolean {
  return /^(?:\r\n|\n|\r)[ \t]*$/u.test(text.slice(previousComment.end, comment.start));
}

function getCommentBody(text: string, comment: CommentRange): string {
  const raw = text.slice(comment.start, comment.end);

  return comment.kind === 'line' ? normalizeLineCommentBody(raw.slice(2)) : normalizeBlockCommentBody(raw);
}
