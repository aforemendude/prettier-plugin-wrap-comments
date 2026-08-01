import { describe, expect, it } from 'vitest';

import { hasPreserveCommentMarker } from '../../../src/comments/comment-eligibility.js';

describe('hasPreserveCommentMarker', () => {
  it('recognizes preserved comment markers from raw syntax', () => {
    expect(hasPreserveCommentMarker('/*! @license text */')).toBe(true);
    expect(hasPreserveCommentMarker('//! @license text')).toBe(true);
    expect(hasPreserveCommentMarker('/* ! @license text */')).toBe(false);
    expect(hasPreserveCommentMarker('// ! @license text')).toBe(false);
  });
});
