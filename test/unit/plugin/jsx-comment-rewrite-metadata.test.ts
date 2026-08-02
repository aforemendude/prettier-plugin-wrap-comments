import type { ParserOptions } from 'prettier';
import { describe, expect, it } from 'vitest';

import {
  isRewrittenJsxBlockComment,
  markRewrittenJsxBlockComments,
  setJsxBlockCommentRewrites,
} from '../../../src/plugin/jsx-comment-rewrite-metadata.js';

describe('JSX comment rewrite metadata', () => {
  it('marks the rewritten block-comment ordinal after the source is parsed again', () => {
    const firstRaw = '/* first */';
    const lineRaw = '// between';
    const rewrittenRaw = ['/*', ' * rewritten', ' */'].join('\n');
    const text = [firstRaw, lineRaw, rewrittenRaw].join('\n');
    const firstComment = createComment(text, firstRaw, 'Block');
    const lineComment = createComment(text, lineRaw, 'Line');
    const rewrittenComment = createComment(text, rewrittenRaw, 'CommentBlock');
    const options = createParserOptions();

    setJsxBlockCommentRewrites(options, [{ blockCommentIndex: 1, text: rewrittenRaw }]);
    markRewrittenJsxBlockComments(text, { comments: [rewrittenComment, lineComment, firstComment] }, options);

    expect(isRewrittenJsxBlockComment(firstComment)).toBe(false);
    expect(isRewrittenJsxBlockComment(lineComment)).toBe(false);
    expect(isRewrittenJsxBlockComment(rewrittenComment)).toBe(true);
  });

  it('does not mark a comment when the recorded replacement was not applied', () => {
    const raw = ['/*', ' * original', ' */'].join('\n');
    const comment = createComment(raw, raw, 'Block');
    const options = createParserOptions();

    setJsxBlockCommentRewrites(options, [{ blockCommentIndex: 0, text: ['/*', ' * different', ' */'].join('\n') }]);
    markRewrittenJsxBlockComments(raw, { comments: [comment] }, options);

    expect(isRewrittenJsxBlockComment(comment)).toBe(false);
  });
});

function createComment(text: string, raw: string, type: 'Block' | 'CommentBlock' | 'Line') {
  const start = text.indexOf(raw);

  return {
    end: start + raw.length,
    start,
    type,
    value: type === 'Line' ? raw.slice(2) : raw.slice(2, -2),
  };
}

function createParserOptions(): ParserOptions {
  return { parser: 'babel' } as ParserOptions;
}
