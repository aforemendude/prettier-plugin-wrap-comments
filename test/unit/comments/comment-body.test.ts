import { describe, expect, it } from 'vitest';

import { normalizeBlockCommentBody } from '../../../src/comments/comment-body.js';

describe('normalizeBlockCommentBody', () => {
  it('normalizes multiline formatting markers', () => {
    expect(normalizeBlockCommentBody(['/*', ' * First line', ' *   - nested item', ' */'].join('\n'))).toBe(
      ['First line', '  - nested item'].join('\n'),
    );
  });

  it('normalizes unstarred multiline indentation', () => {
    expect(normalizeBlockCommentBody(['/*', '   First line', '     - nested item', '*/'].join('\n'))).toBe(
      ['First line', '- nested item'].join('\n'),
    );
  });

  it('normalizes carriage returns', () => {
    expect(normalizeBlockCommentBody(['/*', ' * First line', ' * Second line', ' */'].join('\r\n'))).toBe(
      ['First line', 'Second line'].join('\n'),
    );
  });
});
