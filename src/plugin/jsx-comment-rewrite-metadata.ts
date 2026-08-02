import type { ParserOptions } from 'prettier';

import { collectAstComments } from '../comments/comment-ranges.js';
import { getAstNodeRange } from '../utils/ast.js';
import { isRecord } from '../utils/type-guards.js';

const jsxBlockCommentRewritesKey = Symbol('jsxBlockCommentRewrites');
const rewrittenJsxBlockCommentKey = Symbol('rewrittenJsxBlockComment');

export type JsxBlockCommentRewrite = {
  blockCommentIndex: number;
  text: string;
};

type ParserOptionsWithJsxBlockCommentRewrites = ParserOptions & {
  [jsxBlockCommentRewritesKey]?: readonly JsxBlockCommentRewrite[];
};

type RewrittenJsxBlockComment = Record<string, unknown> & {
  [rewrittenJsxBlockCommentKey]?: true;
};

export function setJsxBlockCommentRewrites(options: ParserOptions, rewrites: readonly JsxBlockCommentRewrite[]): void {
  const metadataOptions = options as ParserOptionsWithJsxBlockCommentRewrites;

  if (rewrites.length === 0) {
    delete metadataOptions[jsxBlockCommentRewritesKey];
    return;
  }

  metadataOptions[jsxBlockCommentRewritesKey] = [...rewrites];
}

export function markRewrittenJsxBlockComments(text: string, ast: unknown, options: ParserOptions): void {
  const metadataOptions = options as ParserOptionsWithJsxBlockCommentRewrites;
  const rewrites = metadataOptions[jsxBlockCommentRewritesKey];

  delete metadataOptions[jsxBlockCommentRewritesKey];

  if (rewrites === undefined) {
    return;
  }

  const blockComments = collectAstComments(ast)
    .filter(isBlockComment)
    .sort((left, right) => getCommentStart(left) - getCommentStart(right));

  for (const rewrite of rewrites) {
    const comment = blockComments[rewrite.blockCommentIndex];
    const range = comment === undefined ? undefined : getAstNodeRange(comment);

    if (comment !== undefined && range !== undefined && text.slice(range.start, range.end) === rewrite.text) {
      (comment as RewrittenJsxBlockComment)[rewrittenJsxBlockCommentKey] = true;
    }
  }
}

export function isRewrittenJsxBlockComment(comment: unknown): boolean {
  return isRecord(comment) && (comment as RewrittenJsxBlockComment)[rewrittenJsxBlockCommentKey] === true;
}

function isBlockComment(comment: unknown): comment is Record<string, unknown> {
  return isRecord(comment) && (comment['type'] === 'Block' || comment['type'] === 'CommentBlock');
}

function getCommentStart(comment: Record<string, unknown>): number {
  return getAstNodeRange(comment)?.start ?? Number.POSITIVE_INFINITY;
}
