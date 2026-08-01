import { describe, expect, it } from 'vitest';

import { toCommentRange } from '../../../src/comments/comment-ranges.js';

describe('toCommentRange', () => {
  it('does not coerce hashbang metadata into a line comment', () => {
    const text = ['#!/usr/bin/env node', 'console.log(1);'].join('\n');
    const hashbangEnd = text.indexOf('\n');

    expect(toCommentRange({ end: hashbangEnd, start: 0, type: 'Line' }, text)).toBeUndefined();
  });
});
