import { describe, expect, it } from 'vitest';

import {
  areCommentsOnAdjacentLines,
  isCommentAdjacentBeforeIndex,
  isStandaloneBlockComment,
  isStandaloneComment,
  isStandaloneLineComment,
} from '../../../src/comments/comment-location.js';
import { createCommentRange } from '../support/comments.js';

describe('standalone comment detection', () => {
  it('classifies line comments by the text before their marker', () => {
    const text = ['  \t// standalone', 'value(); // trailing'].join('\n');

    expect(isStandaloneLineComment(text, createCommentRange(text, '// standalone'))).toBe(true);
    expect(isStandaloneLineComment(text, createCommentRange(text, '// trailing'))).toBe(false);
  });

  it('recognizes standalone line comments after JavaScript Unicode line separators', () => {
    for (const separator of ['\u2028', '\u2029']) {
      const text = ['value();', '  // standalone'].join(separator);

      expect(isStandaloneLineComment(text, createCommentRange(text, '// standalone'))).toBe(true);
    }
  });

  it('accepts ECMAScript horizontal whitespace around standalone comments', () => {
    for (const whitespace of ['\u000b', '\u000c', '\u00a0']) {
      const lineText = `${whitespace}// standalone`;
      const blockText = `${whitespace}/* standalone */${whitespace}`;

      expect(isStandaloneLineComment(lineText, createCommentRange(lineText, '// standalone'))).toBe(true);
      expect(isStandaloneBlockComment(blockText, createCommentRange(blockText, '/* standalone */'))).toBe(true);
    }
  });

  it('requires block comments to be alone on their source line', () => {
    const standaloneText = '  /* standalone */ \t';
    const leadingCodeText = 'value(); /* comment */';
    const trailingCodeText = '/* comment */ value();';

    expect(isStandaloneBlockComment(standaloneText, createCommentRange(standaloneText, '/* standalone */'))).toBe(true);
    expect(isStandaloneBlockComment(leadingCodeText, createCommentRange(leadingCodeText, '/* comment */'))).toBe(false);
    expect(isStandaloneBlockComment(trailingCodeText, createCommentRange(trailingCodeText, '/* comment */'))).toBe(
      false,
    );
  });

  it('dispatches according to the comment kind', () => {
    const text = ['  // line', '  /* block */'].join('\n');

    expect(isStandaloneComment(text, createCommentRange(text, '// line'))).toBe(true);
    expect(isStandaloneComment(text, createCommentRange(text, '/* block */'))).toBe(true);
  });
});

describe('comment adjacency', () => {
  it('accepts horizontal whitespace around exactly one newline', () => {
    const lfText = ['// first', '  // second'].join('\n');
    const crlfText = ['// first', '\t// second'].join('\r\n');
    const trailingWhitespaceText = '/* first */ \t\n  /* second */';

    expect(
      areCommentsOnAdjacentLines(
        lfText,
        createCommentRange(lfText, '// first'),
        createCommentRange(lfText, '// second'),
      ),
    ).toBe(true);
    expect(
      areCommentsOnAdjacentLines(
        crlfText,
        createCommentRange(crlfText, '// first'),
        createCommentRange(crlfText, '// second'),
      ),
    ).toBe(true);
    expect(
      areCommentsOnAdjacentLines(
        trailingWhitespaceText,
        createCommentRange(trailingWhitespaceText, '/* first */'),
        createCommentRange(trailingWhitespaceText, '/* second */'),
      ),
    ).toBe(true);

    for (const separator of ['\u2028', '\u2029']) {
      const text = ['// first', '  // second'].join(separator);

      expect(
        areCommentsOnAdjacentLines(text, createCommentRange(text, '// first'), createCommentRange(text, '// second')),
      ).toBe(true);
    }
  });

  it('accepts ECMAScript horizontal whitespace as indentation after the newline', () => {
    for (const whitespace of ['\u000b', '\u000c', '\u00a0']) {
      const text = `/* first */${whitespace}\n${whitespace}/* second */`;

      expect(
        areCommentsOnAdjacentLines(
          text,
          createCommentRange(text, '/* first */'),
          createCommentRange(text, '/* second */'),
        ),
      ).toBe(true);
    }
  });

  it('rejects same-line, blank-line, and intervening content', () => {
    const sameLineText = '// first /* second */';
    const blankLineText = ['// first', '', '// second'].join('\n');
    const contentText = ['// first', 'value();', '// second'].join('\n');

    expect(
      areCommentsOnAdjacentLines(
        sameLineText,
        createCommentRange(sameLineText, '// first'),
        createCommentRange(sameLineText, '/* second */'),
      ),
    ).toBe(false);
    expect(
      areCommentsOnAdjacentLines(
        blankLineText,
        createCommentRange(blankLineText, '// first'),
        createCommentRange(blankLineText, '// second'),
      ),
    ).toBe(false);
    expect(
      areCommentsOnAdjacentLines(
        contentText,
        createCommentRange(contentText, '// first'),
        createCommentRange(contentText, '// second'),
      ),
    ).toBe(false);
  });

  it('checks adjacency between a comment and a following source index', () => {
    const adjacentText = ['// note', '  value();'].join('\n');
    const trailingWhitespaceText = ['/* note */   ', '  value();'].join('\n');
    const separatedText = ['// note', '', 'value();'].join('\n');

    expect(
      isCommentAdjacentBeforeIndex(
        adjacentText,
        createCommentRange(adjacentText, '// note'),
        adjacentText.indexOf('value'),
      ),
    ).toBe(true);
    expect(
      isCommentAdjacentBeforeIndex(
        trailingWhitespaceText,
        createCommentRange(trailingWhitespaceText, '/* note */'),
        trailingWhitespaceText.indexOf('value'),
      ),
    ).toBe(true);
    expect(
      isCommentAdjacentBeforeIndex(
        separatedText,
        createCommentRange(separatedText, '// note'),
        separatedText.indexOf('value'),
      ),
    ).toBe(false);
  });
});
