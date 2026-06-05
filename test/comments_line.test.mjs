import assert from 'node:assert/strict';
import test from 'node:test';
import { wrapLineCommentGroup } from '../dist/comments/line.js';

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
