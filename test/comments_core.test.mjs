import assert from 'node:assert/strict';
import test from 'node:test';
import { hasPreserveCommentMarker, isDirectiveComment } from '../dist/comments/core.js';
import { getColumnAt, getColumns, makeIndent } from '../dist/shared/text.js';

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

test('measures tabs with the configured tab width', () => {
  assert.equal(getColumns('  \tword', 2), 8);
  assert.equal(getColumns('  \tword', 4), 8);
  assert.equal(getColumns('  \tword', 8), 12);
  assert.equal(getColumns('a\tb', 4), 5);
  assert.equal(getColumns('a\tb', 8), 9);
});

test('measures columns from the current line start', () => {
  const text = 'const value = 1;\n\t  // comment';
  const commentStart = text.indexOf('//');

  assert.equal(getColumnAt(text, commentStart, 2), 4);
  assert.equal(getColumnAt(text, commentStart, 4), 6);
  assert.equal(getColumnAt(text, commentStart, 8), 10);
});

test('creates indentation with spaces or tabs', () => {
  assert.equal(makeIndent(6, { tabWidth: 4, useTabs: false }), '      ');
  assert.equal(makeIndent(6, { tabWidth: 4, useTabs: true }), '\t  ');
  assert.equal(makeIndent(6, { tabWidth: 2, useTabs: true }), '\t\t\t');
  assert.equal(makeIndent(10, { tabWidth: 8, useTabs: true }), '\t  ');
});
