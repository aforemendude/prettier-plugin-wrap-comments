import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, type BuiltInParserName, type Options } from 'prettier';
import { describe, expect, it } from 'vitest';

import plugin from '../../src/index.js';

const expectedFixtureCount = 51;
const fixtureRoot = fileURLToPath(new URL('./fixtures', import.meta.url));
const parserByExtension = {
  js: 'babel',
  jsx: 'babel',
  ts: 'typescript',
  tsx: 'typescript',
} satisfies Record<FixtureExtension, BuiltInParserName>;

const fixtureDirectories = (await readdir(fixtureRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

describe('fixture formatting', () => {
  it('keeps the expected fixture count', () => {
    expect(fixtureDirectories).toHaveLength(expectedFixtureCount);
  });

  it.each(fixtureDirectories)('formats %s', async (fixtureName) => {
    const fixtureDirectory = path.join(fixtureRoot, fixtureName);
    const fixtureFiles = (await readdir(fixtureDirectory)).sort();
    const extension = getFixtureExtension(fixtureFiles);
    const expectedFixtureFiles = [`config.json`, `expected.${extension}.txt`, `original.${extension}.txt`].sort();

    expect(fixtureFiles).toEqual(expectedFixtureFiles);

    const [configText, original, expected] = await Promise.all([
      readFile(path.join(fixtureDirectory, 'config.json'), 'utf8'),
      readFile(path.join(fixtureDirectory, `original.${extension}.txt`), 'utf8'),
      readFile(path.join(fixtureDirectory, `expected.${extension}.txt`), 'utf8'),
    ]);
    const config = JSON.parse(configText) as Options;

    expect(config).not.toHaveProperty('plugins');

    const options: Options = {
      parser: parserByExtension[extension],
      plugins: [plugin],
      ...config,
    };
    const output = await format(original, options);
    const repeatedOutput = await format(output, options);

    expect(output).toBe(expected);
    expect(repeatedOutput).toBe(output);
  });
});

function getFixtureExtension(fixtureFiles: string[]): FixtureExtension {
  const originalFixtureFiles = fixtureFiles.filter((file) => /^original\.(?:js|jsx|ts|tsx)\.txt$/u.test(file));

  expect(originalFixtureFiles).toHaveLength(1);

  const originalFixtureFile = originalFixtureFiles[0];

  if (originalFixtureFile === undefined) {
    throw new Error(`Missing original fixture file in: ${fixtureFiles.join(', ')}`);
  }

  const match = /^original\.(js|jsx|ts|tsx)\.txt$/u.exec(originalFixtureFile);

  if (match === null || !isFixtureExtension(match[1])) {
    throw new Error(`Could not determine fixture extension from: ${fixtureFiles.join(', ')}`);
  }

  return match[1];
}

function isFixtureExtension(value: string | undefined): value is FixtureExtension {
  return value === 'js' || value === 'jsx' || value === 'ts' || value === 'tsx';
}

type FixtureExtension = 'js' | 'jsx' | 'ts' | 'tsx';
