import { describe, expect, it } from 'vitest';

import {
  hasPreserveCommentMarker,
  shouldSkipBlockComment,
  shouldSkipLineComment,
} from '../../../src/comments/comment-eligibility.js';
import { createCommentRange } from '../support/comments.js';

describe('shouldSkipLineComment', () => {
  it.each([
    ['/// <reference path="types.d.ts" />', true],
    ['//! preserved license', true],
    ['// eslint-disable-next-line no-console', true],
    ['// ordinary prose', false],
    ['// ! separated marker', false],
  ] as const)('classifies %s', (text, expected) => {
    expect(shouldSkipLineComment(text, createCommentRange(text, text))).toBe(expected);
  });
});

describe('shouldSkipBlockComment', () => {
  it.each([
    ['/** documentation */', true],
    ['/*! preserved license */', true],
    ['/* */', true],
    ['/* @license package license */', true],
    ['/* ordinary prose */', false],
  ] as const)('classifies %s', (text, expected) => {
    expect(shouldSkipBlockComment(text, createCommentRange(text, text))).toBe(expected);
  });
});

describe('hasPreserveCommentMarker', () => {
  it('recognizes preserved comment markers from raw syntax', () => {
    expect(hasPreserveCommentMarker('/*! @license text */')).toBe(true);
    expect(hasPreserveCommentMarker('//! @license text')).toBe(true);
    expect(hasPreserveCommentMarker('/* ! @license text */')).toBe(false);
    expect(hasPreserveCommentMarker('// ! @license text')).toBe(false);
  });
});
