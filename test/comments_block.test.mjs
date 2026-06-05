import assert from 'node:assert/strict';
import test from 'node:test';
import { wrapBlockComment } from '../dist/comments/block.js';

test('preserves markdown list continuation indentation in block comments', async () => {
  const text = [
    '/*',
    ' * - first item has a very long description that should wrap beneath the marker',
    ' * - second item',
    ' *',
    ' * 1. first ordered item has a very long description that should wrap beneath the number',
    ' * 2. second item',
    ' */',
  ].join('\n');
  const comment = { end: text.length, kind: 'block', start: 0 };

  assert.deepEqual(await wrapBlockComment(text, comment, { printWidth: 44, tabWidth: 2, useTabs: false }), {
    end: text.length,
    start: 0,
    text: [
      '/*',
      ' * - first item has a very long description',
      ' *   that should wrap beneath the marker',
      ' * - second item',
      ' *',
      ' * 1. first ordered item has a very long',
      ' *    description that should wrap beneath',
      ' *    the number',
      ' * 2. second item',
      ' */',
    ].join('\n'),
  });
});
