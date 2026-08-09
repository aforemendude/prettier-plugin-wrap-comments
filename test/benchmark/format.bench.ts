import { format, type Options } from 'prettier';
import { bench, describe } from 'vitest';

import plugin from '../../src/index.js';
import { generateBenchmarkFiles } from './generate-files.js';

const benchmarkFiles = generateBenchmarkFiles();
const benchmarkOptions = {
  iterations: 10,
  time: 500,
  warmupIterations: 2,
  warmupTime: 100,
};

for (const { name, parser, source } of benchmarkFiles) {
  describe(`${name} (${source.length} characters)`, () => {
    const prettierOptions: Options = { parser, printWidth: 100 };
    const pluginOptions: Options = { ...prettierOptions, plugins: [plugin] };

    bench(
      'plain Prettier',
      async () => {
        await format(source, prettierOptions);
      },
      benchmarkOptions,
    );
    bench(
      'Prettier with plugin',
      async () => {
        await format(source, pluginOptions);
      },
      benchmarkOptions,
    );
  });
}
