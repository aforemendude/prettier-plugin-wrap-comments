import assert from 'node:assert/strict';
import test from 'node:test';
import { wrapLineCommentGroup, wrapTrailingLineComment } from '../dist/comments/line.js';

test('preserves markdown list continuation indentation in line comments', async () => {
  const text = [
    '// - first item has a very long description that should wrap beneath the marker',
    '// - second item',
    '//',
    '// 1. first ordered item has a very long description that should wrap beneath the number',
    '// 2. second item',
  ].join('\n');
  const comments = collectLineCommentRanges(text);

  assert.deepEqual(await wrapLineCommentGroup(text, comments, { printWidth: 44, tabWidth: 2, useTabs: false }), {
    end: text.length,
    start: 0,
    text: [
      '// - first item has a very long description',
      '//   that should wrap beneath the marker',
      '// - second item',
      '//',
      '// 1. first ordered item has a very long',
      '//    description that should wrap beneath',
      '//    the number',
      '// 2. second item',
    ].join('\n'),
  });
});

test('uses configured newline sequences in standalone line comment replacements', async () => {
  const text = '// Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda.';
  const comment = { end: text.length, kind: 'line', start: 0 };

  assert.deepEqual(await wrapLineCommentGroup(text, [comment], { endOfLine: 'lf', printWidth: 32, tabWidth: 2 }), {
    end: text.length,
    start: 0,
    text: '// Alpha beta gamma delta\n// epsilon zeta eta theta iota\n// kappa lambda.',
  });
  assert.deepEqual(await wrapLineCommentGroup(text, [comment], { endOfLine: 'crlf', printWidth: 32, tabWidth: 2 }), {
    end: text.length,
    start: 0,
    text: '// Alpha beta gamma delta\r\n// epsilon zeta eta theta iota\r\n// kappa lambda.',
  });
  assert.deepEqual(await wrapLineCommentGroup(text, [comment], { endOfLine: 'cr', printWidth: 32, tabWidth: 2 }), {
    end: text.length,
    start: 0,
    text: '// Alpha beta gamma delta\r// epsilon zeta eta theta iota\r// kappa lambda.',
  });
});

test('uses configured newline sequences in trailing line comment replacements', async () => {
  const text = 'const value = compute(); // Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda.';
  const commentStart = text.indexOf('//');
  const comment = { end: text.length, kind: 'line', start: commentStart };

  assert.deepEqual(await wrapTrailingLineComment(text, comment, { endOfLine: 'crlf', printWidth: 32, tabWidth: 2 }), [
    {
      end: 0,
      start: 0,
      text: '// Alpha beta gamma delta\r\n// epsilon zeta eta theta iota\r\n// kappa lambda.\r\n',
    },
    {
      end: text.length,
      start: commentStart - 1,
      text: '',
    },
  ]);
});

function collectLineCommentRanges(text) {
  return Array.from(text.matchAll(/\/\/[^\n]*/gu), (match) => {
    const start = match.index ?? 0;

    return {
      end: start + match[0].length,
      kind: 'line',
      start,
    };
  });
}
