import type { ParserOptions } from 'prettier';
import { describe, expect, it } from 'vitest';

import plugin from '../../../src/index.js';

describe('parser preprocessing', () => {
  it('returns invalid source unchanged', async () => {
    const invalidSources = {
      babel: 'const = ; // invalid babel source should remain unchanged',
      'babel-ts': 'type = ; // invalid babel-ts source should remain unchanged',
      typescript: 'interface = ; // invalid TypeScript source should remain unchanged',
    } as const;

    for (const [parserName, source] of Object.entries(invalidSources)) {
      const parser = plugin.parsers?.[parserName];

      expect(parser).toBeDefined();
      expect(parser?.preprocess).toBeTypeOf('function');

      if (parser?.preprocess === undefined) {
        throw new Error(`Expected ${parserName} to provide a preprocess hook`);
      }

      await expect(parser.preprocess(source, { parser: parserName } as ParserOptions)).resolves.toBe(source);
    }
  });
});
