import assert from 'node:assert/strict';
import test from 'node:test';
import { hasPreserveCommentMarker, isDirectiveComment, toCommentRange } from '../dist/comments/core.js';

test('recognizes directive comment families', () => {
  const directiveBodies = [
    '@preserve license text',
    '@jsxFrag Fragment',
    '@jsxImportSource @emotion/react',
    '@jsxRuntime automatic',
    '@ts-expect-error long reason',
    '# sourceMappingURL=file.js.map',
    '# sourceURL=file.js',
    '@ sourceMappingURL=file.js.map',
    '@ sourceURL=file.js',
    'sourceMappingURL=file.js.map',
    'sourceURL=file.js',
    '#__NO_SIDE_EFFECTS__',
    '#__PURE__',
    '@__NO_SIDE_EFFECTS__',
    '@__PURE__',
    'biome-ignore lint/style/noDefaultExport',
    'c8 ignore next',
    'deno-lint-ignore no-explicit-any',
    'eslint-disable-next-line no-console',
    'exported globalName',
    'global globalName',
    'globals globalName',
    'istanbul ignore next',
    'jshint esversion: 11',
    'nyc ignore next',
    'oxlint-disable no-console',
    'prettier-ignore-start',
    'stylelint-disable color-no-invalid-hex',
    'tslint:disable-next-line',
    'v8 ignore next',
    'vite-ignore',
    'webpackChunkName: "admin"',
  ];

  for (const body of directiveBodies) {
    assert.equal(isDirectiveComment(body), true, body);
  }
});

test('rejects non-directive comments', () => {
  const nonDirectiveBodies = [
    '@jsxRuntimeful automatic',
    '@ts-expect-errorful sentence',
    'not a directive eslint-disable-next-line',
    'prettier-ignoreful',
    'webpackMagic: true',
  ];

  for (const body of nonDirectiveBodies) {
    assert.equal(isDirectiveComment(body), false, body);
  }
});

test('recognizes preserved comment markers from raw syntax', () => {
  assert.equal(hasPreserveCommentMarker('/*! @license text */'), true);
  assert.equal(hasPreserveCommentMarker('//! @license text'), true);
  assert.equal(hasPreserveCommentMarker('/* ! @license text */'), false);
  assert.equal(hasPreserveCommentMarker('// ! @license text'), false);
});

test('does not coerce hashbang metadata into a line comment', () => {
  const text = '#!/usr/bin/env node\nconsole.log(1);';
  const hashbangEnd = text.indexOf('\n');

  assert.equal(toCommentRange({ end: hashbangEnd, start: 0, type: 'Line' }, text), undefined);
});
