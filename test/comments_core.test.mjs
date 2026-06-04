import assert from 'node:assert/strict';
import test from 'node:test';
import { isDirectiveComment } from '../dist/comments/core.js';

test('recognizes directive comment families', () => {
  const directiveBodies = [
    '@preserve license text',
    '@jsxImportSource @emotion/react',
    '@ts-expect-error long reason',
    '# sourceMappingURL=file.js.map',
    'sourceMappingURL=file.js.map',
    '#__PURE__',
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
    '@jsxRuntime automatic',
    '@ts-expect-errorful sentence',
    'not a directive eslint-disable-next-line',
    'prettier-ignoreful',
    'webpackMagic: true',
  ];

  for (const body of nonDirectiveBodies) {
    assert.equal(isDirectiveComment(body), false, body);
  }
});
