import { describe, expect, it } from 'vitest';

import {
  getCommentBody,
  normalizeBlockCommentBody,
  normalizeLineCommentBody,
} from '../../../src/comments/comment-body.js';
import { createCommentRange } from '../support/comments.js';

describe('getCommentBody', () => {
  it('extracts and normalizes line and block comment ranges', () => {
    const text = ['const value = 1; // line body  ', '/*', ' * block body', ' */'].join('\n');

    expect(getCommentBody(text, createCommentRange(text, '// line body  '))).toBe('line body');
    expect(getCommentBody(text, createCommentRange(text, ['/*', ' * block body', ' */'].join('\n')))).toBe(
      'block body',
    );
  });
});

describe('normalizeLineCommentBody', () => {
  it('normalizes blank bodies and surrounding horizontal whitespace', () => {
    expect(normalizeLineCommentBody(' \t ')).toBe('');
    expect(normalizeLineCommentBody(' body \t')).toBe('body');
    expect(normalizeLineCommentBody('  body  ')).toBe(' body');
  });
});

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

  it('normalizes single-line and empty block comments', () => {
    expect(normalizeBlockCommentBody('/* alpha */')).toBe('alpha');
    expect(normalizeBlockCommentBody('/**/')).toBe('');
    expect(normalizeBlockCommentBody(['/*', '', ' * alpha', '', ' */'].join('\n'))).toBe('alpha');
  });
});
