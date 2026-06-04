# @aforemendude/prettier-plugin-wrap-comments

A Prettier plugin that wraps non-JSDoc JavaScript and TypeScript comments as Markdown. It uses each comment marker's
real column to calculate the available content width, so nested comments wrap more narrowly than top-level comments.

## Requirements

- Node.js 18 or newer
- Prettier 3 or newer

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

## Behavior

The plugin wraps comments for Prettier's `babel`, `babel-ts`, and `typescript` parsers. It runs during parser
preprocessing: the underlying Prettier parser preprocesses and parses the source first, the plugin rewrites eligible
comments from that parsed comment list, and Prettier then formats the rewritten source with its built-in JavaScript and
TypeScript printers. If the parser cannot parse the preprocessed source, the plugin leaves the source unchanged.

Comment text is normalized and reflowed with Prettier's Markdown parser. The available content width is based on
Prettier's `printWidth` minus the column where the comment text starts. `tabWidth`, `useTabs`, and `endOfLine` are used
when measuring and rebuilding comments.

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
the comment is moved above the code and wrapped using the code line's indentation.

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

```ts
if (ready) {
  /*
   * This block comment is wrapped with the nested indentation included in the
   * available width calculation.
   */
  run();
}
```

The plugin leaves these comments unchanged:

- JSDoc comments that start with `/**`
- bang-preserved comments that start with `/*!` or `//!`
- TypeScript-style triple-slash line comments that start with `///`
- empty comment bodies
- directive comments such as `@license`, `@preserve`, JSX and TypeScript pragmas, source map directives, `#__PURE__`,
  `@__PURE__`, lint/coverage/formatter directives, `vite-ignore`, and webpack magic comments

## Supported Parsers

- `babel`
- `babel-ts`
- `typescript`

## Development

```sh
npm install
npm run format:check
npm run test
```

`npm run test` builds `dist` before running the Node test suite. `npm run verify` runs `npm install`,
`npm run format:check`, and `npm run test`.
