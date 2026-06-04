import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';
import plugin from '../dist/index.js';

const expectedTestCount = 9;
const fixtureRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');
const parserByExtension = {
  js: 'babel',
  ts: 'typescript',
};

const fixtureDirectories = (await readdir(fixtureRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

test('keeps the expected fixture count', () => {
  assert.equal(fixtureDirectories.length, expectedTestCount);
});

for (const fixtureName of fixtureDirectories) {
  test(`formats ${fixtureName}`, async () => {
    const fixtureDirectory = path.join(fixtureRoot, fixtureName);
    const fixtureFiles = (await readdir(fixtureDirectory)).sort();
    const extension = getFixtureExtension(fixtureFiles);
    const expectedFixtureFiles = [`config.json.txt`, `expected.${extension}.txt`, `original.${extension}.txt`].sort();

    assert.deepEqual(fixtureFiles, expectedFixtureFiles);

    const [configText, original, expected] = await Promise.all([
      readFile(path.join(fixtureDirectory, 'config.json.txt'), 'utf8'),
      readFile(path.join(fixtureDirectory, `original.${extension}.txt`), 'utf8'),
      readFile(path.join(fixtureDirectory, `expected.${extension}.txt`), 'utf8'),
    ]);
    const config = JSON.parse(configText);
    const output = await format(original, {
      parser: parserByExtension[extension],
      plugins: [plugin],
      ...config,
    });

    assert.equal(output, expected);
  });
}

function getFixtureExtension(fixtureFiles) {
  const originalFixtureFiles = fixtureFiles.filter((file) => /^original\.(?:js|ts)\.txt$/u.test(file));

  assert.equal(originalFixtureFiles.length, 1);

  const match = /^original\.(js|ts)\.txt$/u.exec(originalFixtureFiles[0]);

  assert.ok(match);

  return match[1];
}
