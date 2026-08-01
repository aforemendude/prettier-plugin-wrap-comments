import { describe, expect, it } from 'vitest';

import {
  hasPreserveCommentMarker,
  isDirectiveComment,
  normalizeBlockCommentBody,
  toCommentRange,
} from '../../../src/comments/core.js';

describe('comment classification', () => {
  it('recognizes directive comment families', () => {
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
      expect(isDirectiveComment(body), body).toBe(true);
    }
  });

  it('rejects non-directive comments', () => {
    const nonDirectiveBodies = [
      '@jsxRuntimeful automatic',
      '@ts-expect-errorful sentence',
      'not a directive eslint-disable-next-line',
      'prettier-ignoreful',
      'webpackMagic: true',
    ];

    for (const body of nonDirectiveBodies) {
      expect(isDirectiveComment(body), body).toBe(false);
    }
  });

  it('recognizes preserved comment markers from raw syntax', () => {
    expect(hasPreserveCommentMarker('/*! @license text */')).toBe(true);
    expect(hasPreserveCommentMarker('//! @license text')).toBe(true);
    expect(hasPreserveCommentMarker('/* ! @license text */')).toBe(false);
    expect(hasPreserveCommentMarker('// ! @license text')).toBe(false);
  });

  it('does not coerce hashbang metadata into a line comment', () => {
    const text = '#!/usr/bin/env node\nconsole.log(1);',
      hashbangEnd = text.indexOf('\n');

    expect(toCommentRange({ end: hashbangEnd, start: 0, type: 'Line' }, text)).toBeUndefined();
  });
});

describe('normalizeBlockCommentBody', () => {
  it('normalizes multiline formatting markers', () => {
    expect(
      normalizeBlockCommentBody(`/*
 * First line
 *   - nested item
 */`),
    ).toBe('First line\n  - nested item');
  });

  it('normalizes unstarred multiline indentation', () => {
    expect(
      normalizeBlockCommentBody(`/*
   First line
     - nested item
*/`),
    ).toBe('First line\n- nested item');
  });

  it('normalizes carriage returns', () => {
    expect(normalizeBlockCommentBody('/*\r\n * First line\r\n * Second line\r\n */')).toBe('First line\nSecond line');
  });
});
