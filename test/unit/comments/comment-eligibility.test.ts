import { describe, expect, it } from 'vitest';

import {
  hasFlowCommentTypeMarker,
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
    ['/*:: type Alias = string; */', true],
    ['/*flow-include type Alias = string; */', true],
    ['/*: string */', true],
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

describe('hasFlowCommentTypeMarker', () => {
  it.each([
    '/*: string */',
    '/* : string */',
    '/*\t: string */',
    '/*:: type Alias = string; */',
    '/* :: type Alias = string; */',
    '/*\t:: type Alias = string; */',
    '/*flow-include type Alias = string; */',
    '/* flow-include type Alias = string; */',
    '/*\tflow-include type Alias = string; */',
  ])('recognizes %s', (rawComment) => {
    expect(hasFlowCommentTypeMarker(rawComment)).toBe(true);
  });

  it.each([
    '/* ordinary prose */',
    '/* flow include type Alias = string; */',
    '/* Flow-include type Alias = string; */',
    ['/*', ':: type Alias = string;', '*/'].join('\n'),
  ])('rejects %s', (rawComment) => {
    expect(hasFlowCommentTypeMarker(rawComment)).toBe(false);
  });
});
