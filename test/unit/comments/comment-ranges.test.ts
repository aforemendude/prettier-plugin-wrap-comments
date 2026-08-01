import { describe, expect, it } from 'vitest';

import { collectAstComments, collectCommentEntries, toCommentRange } from '../../../src/comments/comment-ranges.js';
import type { RawComment } from '../../../src/comments/comment-ranges.js';

describe('collectAstComments', () => {
  it('uses top-level comments before program comments', () => {
    const topLevelComments: RawComment[] = [{ end: 7, start: 0 }];
    const programComments: RawComment[] = [{ end: 18, start: 8 }];

    expect(collectAstComments({ comments: topLevelComments, program: { comments: programComments } })).toBe(
      topLevelComments,
    );
    expect(collectAstComments({ program: { comments: programComments } })).toBe(programComments);
  });

  it('returns an empty list when neither comment collection is an array', () => {
    expect(collectAstComments({ comments: null, program: { comments: 'invalid' } })).toEqual([]);
    expect(collectAstComments({})).toEqual([]);
    expect(collectAstComments(null)).toEqual([]);
    expect(collectAstComments(undefined)).toEqual([]);
  });
});

describe('collectCommentEntries', () => {
  it('filters invalid metadata and sorts entries by source position', () => {
    const text = ['// first', 'const value = 1;', '/* second */'].join('\n');
    const firstStart = text.indexOf('// first');
    const secondStart = text.indexOf('/* second */');
    const firstRaw = { end: firstStart + '// first'.length, start: firstStart, value: ' first' };
    const secondRaw = { range: [secondStart, secondStart + '/* second */'.length], value: ' second ' };
    const invalidRaw = { end: 4, start: 4, value: 'invalid' };

    expect(collectCommentEntries({ comments: [secondRaw, invalidRaw, firstRaw] }, text)).toEqual([
      {
        range: { end: firstStart + '// first'.length, kind: 'line', start: firstStart },
        raw: firstRaw,
      },
      {
        range: { end: secondStart + '/* second */'.length, kind: 'block', start: secondStart },
        raw: secondRaw,
      },
    ]);
  });
});

describe('toCommentRange', () => {
  it('derives comment kinds from source syntax and accepts range metadata', () => {
    const text = ['// line', '/* block */'].join('\n');
    const blockStart = text.indexOf('/* block */');

    expect(toCommentRange({ end: '// line'.length, start: 0, type: 'Unexpected' }, text)).toEqual({
      end: '// line'.length,
      kind: 'line',
      start: 0,
    });
    expect(toCommentRange({ range: [blockStart, text.length] }, text)).toEqual({
      end: text.length,
      kind: 'block',
      start: blockStart,
    });
  });

  it('rejects missing, invalid, and non-comment ranges', () => {
    const text = 'plain text';

    expect(toCommentRange({}, text)).toBeUndefined();
    expect(toCommentRange({ end: 2, start: 2 }, text)).toBeUndefined();
    expect(toCommentRange({ end: 2, start: 3 }, text)).toBeUndefined();
    expect(toCommentRange({ end: text.length, start: 0 }, text)).toBeUndefined();
  });

  it('does not coerce hashbang metadata into a line comment', () => {
    const text = ['#!/usr/bin/env node', 'console.log(1);'].join('\n');
    const hashbangEnd = text.indexOf('\n');

    expect(toCommentRange({ end: hashbangEnd, start: 0, type: 'Line' }, text)).toBeUndefined();
  });
});
