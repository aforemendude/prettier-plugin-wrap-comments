# prettier-plugin-wrap-comments

A Prettier plugin that wraps non-JSDoc JavaScript and TypeScript comments as
Markdown. It uses the comment marker's real column to calculate the available
content width, so nested comments wrap more narrowly than top-level comments.

## Install

```sh
npm install --save-dev prettier-plugin-wrap-comments prettier
```

## Use

Add the plugin to your Prettier config:

```json
{
  "plugins": ["prettier-plugin-wrap-comments"]
}
```

Then run Prettier normally:

```sh
npx prettier . --write
```

## Behavior

The plugin wraps standalone `//` and `/* ... */` comments before Prettier
parses the file, then delegates formatting to Prettier's built-in JavaScript
and TypeScript parsers.

```ts
function example() {
  // This long paragraph is wrapped as Markdown, and the nested indentation is
  // subtracted from the configured print width.
  return true;
}
```

JSDoc comments are left unchanged:

```ts
/**
 * This documentation comment is not wrapped by the plugin.
 */
```

Tooling directives such as `eslint-disable`, `@ts-expect-error`,
`prettier-ignore`, source maps, and TypeScript triple-slash directives are also
left untouched so their meaning is not changed. Trailing comments after code are
also left unchanged because Prettier repositions continuation comments after
parsing.

## Supported Parsers

- `babel`
- `babel-ts`
- `typescript`

## Development

```sh
npm install
npm run check
```
