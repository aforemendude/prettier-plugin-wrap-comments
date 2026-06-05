# Code Review

Reviewed on 2026-06-05.

## Summary

I reviewed the parser wrapper, comment collection and rewrite pipeline, fixture harness, package scripts, and README
behavior claims. Baseline checks pass:

- `npm run test`
- `npm run format:check`

The main risk is not build stability; it is source preservation in less-covered comment forms. I found three behavior
bugs that can rewrite text users reasonably expect to remain unchanged.

## Findings

### High: TypeScript hashbangs are rewritten as `//` comments

`src/comments/core.ts:17` falls back to `comment.type.includes('Line')` when the source text at the reported range does
not start with `//` or `/*`. The TypeScript parser reports a hashbang as a `Line` comment with range `[0, 19]`, so the
plugin treats `#!/usr/bin/env node` as a normal line comment. Then `src/comments/line.ts:28` slices from
`comment.start + 2`, dropping `#!`, and `wrapLineCommentGroup` rebuilds it with `//`.

Repro:

```ts
#!/usr/bin/env node
console.log(1);
```

Formatting with:

```js
await format(input, {
  parser: 'typescript',
  plugins: [plugin],
  printWidth: 80,
});
```

produces:

```ts
// /usr/bin/env node
console.log(1);
```

With an adjacent standalone comment, the shebang is also grouped into the Markdown paragraph and merged with the next
comment. This breaks executable TypeScript scripts that rely on a hashbang.

Suggested fix: make `toCommentRange` require the source text to start with an actual supported comment marker before
returning a range, or explicitly skip `#!`/`InterpreterDirective`-style ranges. Add a TypeScript fixture for a
file-level hashbang with and without an adjacent long line comment.

### High: block-form `prettier-ignore` does not protect trailing comments from preprocessing

`collectPrettierIgnoredLineRanges` only treats standalone line comments as ignore markers because it requires
`comment.kind === 'line'` at `src/comments/wrap.ts:187`. Prettier also honors block-form ignore markers such as
`/* prettier-ignore */` before the next AST node. Since the plugin misses those ranges during preprocessing, it can
rewrite comments inside code that Prettier would otherwise leave untouched.

Repro:

```ts
/* prettier-ignore */
const value = 1; // This trailing line comment is very long and should not move if the block prettier-ignore protects the next statement.
```

Vanilla Prettier leaves the ignored statement and trailing comment unchanged. With this plugin and `printWidth: 60`, the
output becomes:

```ts
/* prettier-ignore */
// This trailing line comment is very long and should not
// move if the block prettier-ignore protects the next
// statement.
const value = 1;
```

That violates Prettier's ignore contract before Prettier's own parser/printer gets a chance to enforce it.

Suggested fix: let `collectPrettierIgnoredLineRanges` accept standalone block comments whose normalized body is exactly
`prettier-ignore`, not only line comments. Add fixtures for block-form ignore before a statement with an overlong
trailing line comment and before a nested block containing comments.

### Medium: unprefixed `*` Markdown bullets in block comments lose their bullet markers

`normalizeBlockCommentBody` strips a leading `*` from every nonblank multiline block-comment line after indentation
removal (`src/comments/core.ts:73`). That works for star-prefixed block comment decoration, but it also strips real
Markdown bullet markers in block comments that are not using a decorative prefix.

Repro:

```text
/*
* First bullet item with enough text to wrap across lines and stay a Markdown bullet.
* Second bullet item with enough text to wrap across lines and stay a Markdown bullet.
*/
const value = 1;
```

With `printWidth: 60`, the output becomes a paragraph:

```ts
/*
 * First bullet item with enough text to wrap across lines
 * and stay a Markdown bullet. Second bullet item with
 * enough text to wrap across lines and stay a Markdown
 * bullet.
 */
const value = 1;
```

The same list written with `-` bullets or with explicit decorative prefixes survives. The ambiguous case is a real
content-loss edge because the plugin advertises Markdown wrapping for block comments.

Suggested fix: only strip decorative leading stars when the block consistently uses a conventional star-prefixed layout,
or preserve `* ` as content when there is no leading space/decorative indentation before it. Add coverage for unprefixed
`*` bullets and conventional `* * bullet` star-prefixed bullets.

## Coverage Gaps To Close

- TypeScript hashbang preservation.
- Block-form `/* prettier-ignore */` before ignored nodes.
- Block comments containing unprefixed Markdown `*` bullets.
- Parser coverage is intentionally limited to `babel`, `babel-ts`, and `typescript`; tests should continue to make that
  explicit if README support remains scoped that way.
