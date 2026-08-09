# @aforemendude/prettier-plugin-wrap-comments

A Prettier plugin that wraps non-JSDoc JavaScript and TypeScript comments as Markdown. It uses each comment marker's
real column to calculate the available content width, so nested comments wrap more narrowly than top-level comments.

## Requirements

- Node.js 20 or newer to use the plugin
- Node.js 22.12 or newer to develop the plugin
- Prettier 3 (`>=3.0.0 <4.0.0`)

## Install

```sh
npm install --save-dev @aforemendude/prettier-plugin-wrap-comments prettier
```

## Use

Add the plugin to your Prettier config:

```json
{
  "plugins": ["@aforemendude/prettier-plugin-wrap-comments"]
}
```

Then run Prettier normally:

```sh
npx prettier --write .
```

### Use With `prettier-plugin-jsdoc`

When using both plugins, `@aforemendude/prettier-plugin-wrap-comments` must be loaded after `prettier-plugin-jsdoc`:

```json
{
  "plugins": ["prettier-plugin-jsdoc", "@aforemendude/prettier-plugin-wrap-comments"]
}
```

This order is required regardless of `prettier-plugin-jsdoc`'s documentation saying that it should be the last plugin.
With wrap-comments last, ordinary comments are handled here and parsing is delegated to the preceding JSDoc plugin, so
JSDoc comments are formatted as well.

### Cache Repeated CLI Runs

Prettier's CLI cache skips files that have not changed since a successful formatting pass. Enable it in package scripts
so contributors use it consistently. This repository uses the faster `metadata` strategy for local formatting:

```json
{
  "scripts": {
    "format": "prettier --write --cache --cache-strategy metadata .",
    "format:check": "prettier --check --cache --cache-strategy metadata .",
    "format:nocache": "prettier --write ."
  }
}
```

The first cached run still processes every file; later runs skip files whose relevant metadata and other cache keys have
not changed. Omit `--cache-strategy metadata` to use the default `content` strategy when workflows such as Git
operations frequently change timestamps without changing file contents.

By default, Prettier stores the cache under `node_modules/.cache/prettier/`, which is normally excluded from version
control with `node_modules`. Prettier does not include plugin versions or implementations in its cache keys, so run the
uncached command once after updating this plugin or another Prettier plugin. Running Prettier without `--cache`, as the
`format:nocache` script does, also removes the default cache. See [Prettier's CLI cache documentation][prettier-cache]
for cache keys, strategies, and custom cache locations.

## Behavior

The plugin wraps comments for Prettier's `babel`, `babel-ts`, and `typescript` parsers. It runs during parser
preprocessing: the nearest preceding plugin for the selected parser, or Prettier's built-in parser when there is none,
preprocesses and parses the source first. This plugin rewrites eligible comments from that parsed comment list, and
Prettier then formats the rewritten source with its built-in JavaScript and TypeScript printers. If the parser cannot
parse the preprocessed source, the plugin leaves the source unchanged.

Offset-sensitive formatting is conservative. Full-file `formatWithCursor` calls skip comment rewriting so Prettier can
map the cursor from the original source. During range formatting, preprocessing does not rewrite text outside Prettier's
selected range; eligible comments inside that range can still be wrapped.

Comment text is normalized and reflowed with Prettier's Markdown parser. The available content width is based on
Prettier's `printWidth` minus the column where the comment text starts. `tabWidth`, `useTabs`, and `endOfLine` are used
when measuring and rebuilding comments. When `tabWidth` is `0`, tabs contribute zero columns during measurement, as they
do in Prettier. If the plugin must synthesize indentation at a positive column, it uses spaces because zero-width tabs
cannot advance to that column.

Standalone `//` comments are wrapped in place. Adjacent standalone line comments are combined and reflowed as one
Markdown block when they are directly next to each other and their `//` markers start in the same column.

```ts
function example() {
  // This long paragraph is wrapped as Markdown, and the nested indentation is
  // subtracted from the configured print width.
  return true;
}
```

Trailing `//` comments stay in place when the full source line fits within `printWidth`. If the source line is too long,
the comment is moved above the code and normally wrapped using the code line's indentation. On a line made up of closing
delimiters such as `}`, `]`, or `)`, the moved comment is indented one additional level so it remains visually inside
the construct being closed. When a comment directly trails the root value of a JSX expression or template interpolation,
it can move above that value and wrap inside the expression delimiters. Nested or otherwise ambiguous expression
comments and comments in JSX spreads stay in place.

```ts
function example() {
  // This trailing comment moved above the statement because the original line
  // was too long.
  const value = 1;
}
```

Non-JSDoc `/* ... */` comments are also normalized as Markdown. A block comment may stay on one line if the normalized
comment fits within `printWidth`; otherwise, only standalone block comments are expanded into star-prefixed blocks. Long
inline block comments are left unchanged when they cannot fit on one line.

Multiline block comments are normalized as conventional block-comment text before Markdown parsing: leading indentation
is removed, and a `*` that is the first non-whitespace character on a body line is treated as comment formatting, not
Markdown content. This also applies to unstarred `/* ... */` blocks, so use line comments when Markdown-significant
indentation or leading `*` characters must be preserved exactly.

```ts
if (ready) {
  /*
   * This block comment is wrapped with the nested indentation included in the
   * available width calculation.
   */
  run();
}
```

JSX and TSX expression comments use the expression contents, not the outer React expression braces, to decide whether a
block comment is standalone, leading, trailing, or inline. A comment-only expression like `{/* ... */}` can wrap as a
standalone JSX comment. A leading expression comment like `{/* ... */ label}` can move above `label` and wrap. A
trailing expression comment like `{label /* ... */}` can move before `label` and wrap. A true inline expression comment
like `{"abc" + /* ... */ "123"}` is left unchanged when it cannot fit on one line.

<!-- prettier-ignore-start -->
```tsx
<span>
  {
    /*
     * This expression comment wraps because the surrounding JSX braces do not
     * make it inline.
     */
  }
  {
    /*
     * This expression comment moved above the expression value because it was
     * leading.
     */
    label
  }
  {
    /*
     * This expression comment moved above the expression value because it was
     * trailing.
     */
    label
  }
  {'abc' + /* This inline expression comment stays in place. */ '123'}
</span>
```
<!-- prettier-ignore-end -->

`prettier-ignore` markers are preserved and affect wrapping only when the marker body is exactly `prettier-ignore`. When
one of these markers is directly above a standalone block comment, the plugin leaves that block comment unchanged. If
the block comment is one the plugin would otherwise wrap, the following code still formats normally; if the block
comment is already skipped by the plugin, such as a JSDoc or directive block, Prettier keeps its normal ignore behavior
for the following code.

An exact `// prettier-ignore` marker can also apply to the following adjacent standalone `//` comment group. The plugin
leaves that group unchanged and neutralizes the marker for Prettier, so code after the ignored comment group still
formats normally.

For trailing line comments, a standalone exact-body `prettier-ignore` marker, written as `// prettier-ignore` or
`/* prettier-ignore */`, can apply to the code line and its inline comment. The plugin walks past adjacent standalone
comments that it normally leaves alone, such as an `eslint-disable-next-line` directive, so an ignored code line's
trailing comment remains inline and unchanged. A directive comment by itself does not ignore the following code line;
without `prettier-ignore`, an overlong trailing comment below a directive is still moved above the statement and
wrapped.

The plugin leaves these comments unchanged:

- JSDoc comments that start with `/**`
- bang-preserved comments that start with `/*!` or `//!`
- TypeScript-style triple-slash line comments that start with `///`
- Flow type annotations and includes that start with `/*:`, `/*::`, or `/*flow-include`, including Flow's supported
  spaces or tabs before the marker
- empty comment bodies
- `prettier-ignore` markers themselves
- other directive comments such as `@license`, `@preserve`, JSX, TypeScript, and Flow pragmas, Flow error suppressions,
  `flowlint` comments, source map directives, `#__PURE__`, `@__PURE__`, exact Node test coverage controls, other
  lint/coverage/formatter directives, `vite-ignore`, and webpack magic comments

## Supported Parsers

- `babel`
- `babel-ts`
- `typescript`

## Performance

`npm run benchmark` compares uncached, in-memory `prettier.format()` calls with and without the plugin across five
generated files. Lower times are better. The plugin/plain column divides the plugin mean by the plain Prettier mean.

These results are from a representative run on August 8, 2026, using Linux 6.8, an Intel Core i7-10750H, Node.js
24.18.0, Prettier 3.9.6, and Vitest 4.1.10. The suite was configured with `time: 500`, `iterations: 10`,
`warmupTime: 100`, and `warmupIterations: 2` for each case.

| Generated workload                         | Characters | Plain Prettier mean |        Plugin mean | Plugin/plain |
| ------------------------------------------ | ---------: | ------------------: | -----------------: | -----------: |
| Comment-free JavaScript                    |     29,995 |  54.78 ms (±10.09%) |  45.59 ms (±5.82%) |        0.83× |
| Code-heavy JavaScript with sparse comments |     30,494 |   44.05 ms (±3.22%) | 135.66 ms (±3.81%) |        3.08× |
| Comment-heavy TypeScript                   |     64,432 |  56.75 ms (±11.82%) | 327.61 ms (±2.67%) |        5.77× |
| Preformatted comment-heavy TypeScript      |     54,467 |   54.54 ms (±2.47%) | 279.65 ms (±2.50%) |        5.13× |
| JSX-comment-heavy TSX                      |     40,575 |   57.52 ms (±6.87%) | 263.67 ms (±3.83%) |        4.58× |

The comment-free case takes the plugin's early exit after scanning for comment delimiters. Its apparent speedup should
be treated as benchmark variation, not as an expected optimization over plain Prettier. In this run, sparse comments
took about 3.08× the plain formatting time, while comment-heavy inputs took 4.58–5.77×. These measurements isolate
formatter work on changed files; enabling the CLI cache above skips that work for unchanged files.

## Development

Source files are organized by responsibility. `src/plugin/` contains parser and printer integration,
`src/comments/wrap-comments.ts` coordinates the rewriting pipeline, the other `src/comments/` modules isolate comment
analysis and wrapping concerns, and `src/utils/` contains reusable utilities. Unit tests under `test/unit/` mirror those
concerns and source file names wherever practical.

```sh
npm install
npm run benchmark
npm run format:check
npm run typecheck
npm run test
npm run build
```

`npm run test` runs the TypeScript unit and fixture-based integration suites with Vitest. Use `npm run test:unit` or
`npm run test:integration` to run one suite. `npm run build` removes and recreates `dist` using a cross-platform Node
cleanup script, and `npm run verify` runs formatting, type checking, the build, and both test suites.

`npm run benchmark` compares plain Prettier with Prettier using the plugin. Its JavaScript, TypeScript, and TSX inputs
are generated in memory by the files under `test/benchmark`, so large benchmark fixtures are not stored in the
repository. Benchmarks use Vitest's separate benchmark mode and do not run as part of `npm run test` or
`npm run verify`.

[prettier-cache]: https://prettier.io/docs/cli#--cache
