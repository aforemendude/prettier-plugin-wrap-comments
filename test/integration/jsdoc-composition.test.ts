import { format, type BuiltInParserName, type Options } from 'prettier';
import { describe, expect, it } from 'vitest';

import wrapCommentsPlugin from '../../src/index.js';

const parserCases = [
  { declaration: 'function add(left, right) {', parser: 'babel' },
  { declaration: 'function add(left: number, right: number): number {', parser: 'babel-ts' },
  { declaration: 'function add(left: number, right: number): number {', parser: 'typescript' },
] satisfies { declaration: string; parser: BuiltInParserName }[];

describe('prettier-plugin-jsdoc composition', () => {
  it.each(parserCases)(
    'formats JSDoc, wraps ordinary comments, and remains stable with $parser',
    async ({ declaration, parser }) => {
      const original = [
        '/** adds two values',
        ' * @param { number } left the first value',
        ' * @param { number } right the second value',
        ' * @returns { number } the total',
        ' */',
        declaration,
        '  // This ordinary comment contains enough words that wrap-comments must wrap it across multiple lines.',
        '  return left + right;',
        '}',
        '',
      ].join('\n');
      const expected = [
        '/**',
        ' * Adds two values',
        ' *',
        ' * @param {number} left The first value',
        ' * @param {number} right The second value',
        ' * @returns {number} The total',
        ' */',
        declaration,
        '  // This ordinary comment contains enough words that',
        '  // wrap-comments must wrap it across multiple lines.',
        '  return left + right;',
        '}',
        '',
      ].join('\n');
      const options: Options = {
        parser,
        plugins: ['prettier-plugin-jsdoc', wrapCommentsPlugin],
        printWidth: 58,
      };
      const output = await format(original, options);

      expect(output).toBe(expected);
      await expect(format(output, options)).resolves.toBe(output);
    },
  );
});
