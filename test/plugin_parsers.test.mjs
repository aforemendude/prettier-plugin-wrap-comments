import assert from 'node:assert/strict';
import test from 'node:test';
import plugin from '../dist/index.js';

test('parser preprocess returns invalid source unchanged', async () => {
  const invalidSources = {
    babel: 'const = ; // invalid babel source should remain unchanged',
    'babel-ts': 'type = ; // invalid babel-ts source should remain unchanged',
    typescript: 'interface = ; // invalid TypeScript source should remain unchanged',
  };

  for (const [parserName, source] of Object.entries(invalidSources)) {
    const parser = plugin.parsers[parserName];

    assert.ok(parser);
    assert.equal(await parser.preprocess(source, { parser: parserName }), source);
  }
});
