import { describe, expect, it } from 'vitest';

import { isDirectiveComment, isPrettierIgnoreComment } from '../../../src/comments/comment-directives.js';

describe('isDirectiveComment', () => {
  it('recognizes directive comment families', () => {
    const directiveBodies = [
      '  @flow strict',
      '@noflow',
      '  @license package license',
      '@preserve license text',
      '@jsx createElement',
      '@jsxFrag Fragment',
      '@jsxImportSource @emotion/react',
      '@jsxRuntime automatic',
      '@ts-check',
      '@ts-expect-error long reason',
      '@ts-ignore long reason',
      '@ts-nocheck',
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
      'eslint no-console',
      'eslint-disable-next-line no-console',
      'exported globalName',
      'flowlint sketchy-null-bool:off',
      'flowlint-line sketchy-null-bool:off',
      'flowlint-next-line sketchy-null-bool:off',
      'global globalName',
      'globals globalName',
      'istanbul ignore next',
      'jshint esversion: 11',
      'nyc ignore next',
      'oxlint-disable no-console',
      'prettier-ignore',
      'prettier-ignore-start',
      'prettier-ignore-end',
      'stylelint-disable color-no-invalid-hex',
      'tslint:disable-next-line',
      'v8 ignore next',
      'vite-ignore',
      'webpackChunkName: "admin"',
      '$FlowFixMe[incompatible-type]',
      '$FlowExpectedError[incompatible-type]',
    ];

    for (const body of directiveBodies) {
      expect(isDirectiveComment(body), body).toBe(true);
    }
  });

  it('rejects non-directive comments', () => {
    const nonDirectiveBodies = [
      '@flowing prose',
      '@jsxRuntimeful automatic',
      '@ts-expect-errorful sentence',
      '$FlowFixMeLater[incompatible-type]',
      'flowlinting sketchy-null-bool:off',
      'not a directive eslint-disable-next-line',
      'prettier-ignoreful',
      'webpackMagic: true',
    ];

    for (const body of nonDirectiveBodies) {
      expect(isDirectiveComment(body), body).toBe(false);
    }
  });
});

describe('isPrettierIgnoreComment', () => {
  it('accepts only the complete directive after trimming whitespace', () => {
    expect(isPrettierIgnoreComment(' \tprettier-ignore\n')).toBe(true);
    expect(isPrettierIgnoreComment('prettier-ignore-start')).toBe(false);
    expect(isPrettierIgnoreComment('prettier-ignore because this is generated')).toBe(false);
    expect(isPrettierIgnoreComment('prefix prettier-ignore')).toBe(false);
  });
});
