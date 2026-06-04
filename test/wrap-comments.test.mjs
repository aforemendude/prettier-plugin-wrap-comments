import assert from 'node:assert/strict';
import test from 'node:test';
import { format } from 'prettier';
import plugin from '../dist/index.js';

async function formatTypeScript(source, printWidth = 48) {
  return format(source, {
    parser: 'typescript',
    plugins: [plugin],
    printWidth,
  });
}

test('wraps line comments using the available width after indentation', async () => {
  const output = await formatTypeScript(
    `function demo() {
  // This sentence should wrap around the nested indentation and stay under the configured width while preserving **markdown** emphasis.
  return 1;
}
`,
    52,
  );

  const commentLines = output.split('\n').filter((line) => line.trimStart().startsWith('//'));

  assert.ok(commentLines.length > 1);
  assert.equal(
    commentLines.every((line) => line.length <= 52),
    true,
  );
  assert.equal(
    commentLines.every((line) => line.startsWith('  //')),
    true,
  );
});

test('wraps adjacent line comments as one markdown document', async () => {
  const output = await formatTypeScript(
    `// This paragraph starts on one commented line and continues on the next commented line so that markdown can reflow it together.
// It also keeps the text wrapped at the configured print width.
const value = 1;
`,
    54,
  );

  const commentLines = output.split('\n').filter((line) => line.startsWith('//'));

  assert.ok(commentLines.length > 2);
  assert.equal(
    commentLines.every((line) => line.length <= 54),
    true,
  );
});

test('wraps non-JSDoc block comments', async () => {
  const output = await formatTypeScript(
    `if (ready) {
  /* This block comment should become a star-prefixed block and wrap with the nested indentation included in the available width calculation. */
  run();
}
`,
    56,
  );

  assert.match(output, /  \/\*\n   \* This block comment should become/u);
  assert.equal(
    output
      .split('\n')
      .filter((line) => line.includes('*') && !line.includes('*/'))
      .every((line) => line.length <= 56),
    true,
  );
});

test('does not wrap trailing line comments', async () => {
  const source = `const value = 1; // This trailing comment should stay on one line because Prettier repositions continuation comments after parsing.
`;
  const output = await formatTypeScript(source, 56);
  const commentLines = output.split('\n').filter((line) => line.includes('//'));

  assert.equal(commentLines.length, 1);
  assert.match(
    output,
    /This trailing comment should stay on one line because Prettier repositions continuation comments/u,
  );
});

test('does not wrap JSDoc comments', async () => {
  const source = `/**
 * This JSDoc line is intentionally long and should remain a single documentation comment line because the plugin only wraps non-Javadoc comments.
 */
function demo() {}
`;
  const output = await formatTypeScript(source, 56);

  assert.match(output, /This JSDoc line is intentionally long and should remain a single documentation comment line/u);
});

test('does not wrap functional directive comments', async () => {
  const source = `// eslint-disable-next-line @typescript-eslint/no-explicit-any -- this long directive must stay on one line because wrapping it can change tooling behavior
const value: any = 1;
`;
  const output = await formatTypeScript(source, 56);

  assert.match(
    output,
    /eslint-disable-next-line @typescript-eslint\/no-explicit-any -- this long directive must stay on one line/u,
  );
});
