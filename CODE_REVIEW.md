# Code Review

Date: 2026-06-04

Scope reviewed: `src`, `test`, fixtures, `package.json`, `tsconfig.json`, and `README.md`. `dist` was rebuilt by the
test command and treated as generated output.

Verification performed:

- `npm test` passes.
- `npm run format:check` passes.
- `npm run check` fails because no `check` script is defined.
- Targeted Prettier repros were run against the built plugin for the findings below.

## Findings

### High: directive detection misses important directives and mutates them

Affected code:

- `src/comments/core.ts:89-92` contains the directive allow-list.
- `src/comments/line.ts:101-108` relies on that allow-list before wrapping line comments.
- `src/comments/block.ts:24-27` relies on that allow-list before wrapping block comments.

Several comments that should remain byte-compatible are not skipped and can be changed by Markdown formatting:

```js
//# sourceURL=really-long-generated-source-url-that-should-stay-directive.js
```

Observed output:

```js
// # sourceURL=really-long-generated-source-url-that-should-stay-directive.js
```

```js
//@ sourceMappingURL=legacy-map-directive-that-should-remain-byte-compatible.js.map
```

Observed output at narrow width:

```js
// @
// sourceMappingURL=legacy-map-directive-that-should-remain-byte-compatible.js.map
```

```ts
const value = /*#__NO_SIDE_EFFECTS__*/ factory();
```

Observed output:

```ts
const value = /* #**NO_SIDE_EFFECTS** */ factory();
```

The current regex handles `#__PURE__` and `@__NO_SIDE_EFFECTS__`, but not `#__NO_SIDE_EFFECTS__`. It also handles modern
`//# sourceMappingURL=...`, but not `//# sourceURL=...` or legacy `//@ sourceMappingURL=...`. JSX pragmas such as
`@jsxRuntime` and `@jsxFrag` are also not covered and can be wrapped when they carry long text.

Suggested fixes:

- Extend directive detection for `sourceURL`, legacy `@ sourceMappingURL`, `@jsxRuntime`, `@jsxFrag`, and
  `[#@]__NO_SIDE_EFFECTS__`.
- Add fixtures proving these comments are left unchanged.
- Prefer matching raw directive syntax before normalizing through Markdown, because the marker itself can be
  semantically meaningful.

### High: bang-preserved license comments lose their preservation marker

Affected code:

- `src/comments/block.ts:20-27` skips JSDoc and normalized directive bodies, but not `/*!...*/`.
- `src/comments/line.ts:101-108` skips normalized directives, but not `//!...`.
- `src/comments/core.ts:89-92` does not treat leading `!` as a preservation marker.

Minifiers and bundlers commonly treat `/*!...*/` and `//!...` as preserve-license comments. The plugin rewrites both
forms and separates the bang from the comment marker:

```ts
/*! @license VeryLongLibraryName copyright text that should remain a bang-preserved license comment for minifiers. */
export const value = 1;
```

Observed output:

```ts
/*
 * ! @license VeryLongLibraryName copyright text
 * that should remain a bang-preserved license
 * comment for minifiers.
 */
export const value = 1;
```

```ts
//! @license VeryLongLibraryName copyright text that should remain a bang-preserved license comment for minifiers.
export const value = 1;
```

Observed output:

```ts
// ! @license VeryLongLibraryName copyright text
// that should remain a bang-preserved license
// comment for minifiers.
export const value = 1;
```

This can cause license comments to be dropped by downstream tooling.

Suggested fixes:

- Skip raw comments starting with `/*!` or `//!`.
- Add fixtures for both bang-preserved block and line comments.

### Medium: moving trailing comments above closing delimiter lines changes their location

Affected code:

- `src/comments/line.ts:69-98` moves long trailing line comments above `codeText` without considering whether the code
  text is only a closing delimiter.

For comments after a closing brace, paren, bracket, or `};`, the replacement moves the comment inside the syntactic
construct instead of keeping it after the completed construct.

Input:

```ts
const config = {
  enabled: true,
}; // This comment is about the config declaration and should stay after the statement.
next();
```

Observed output:

```ts
const config = {
  enabled: true,
  // This comment is about the config declaration
  // and should stay after the statement.
};
next();
```

Similar behavior occurs for `} // ...` and `); // ...`, where the comment is moved inside the block or call. That
changes comment attachment and can surprise users even when runtime semantics are unchanged.

Suggested fixes:

- Do not move trailing comments on lines whose trimmed code starts with closing delimiters such as `}`, `]`, or `)`.
- Alternatively, use AST/token context to decide whether a trailing comment can safely become a leading comment.
- Add fixtures for closing brace, closing paren, and `};` trailing comments.

### Medium: test coverage misses the highest-risk behavior

Affected code:

- `test/index.test.mjs`
- `test/fixtures/*`

The existing fixtures cover the basic happy paths, but they do not cover the cases most likely to break users:

- Overlapping replacements on a line with both block and trailing line comments.
- Directive preservation for source maps, source URLs, JSX pragmas, and no-side-effects annotations.
- Bang-preserved license comments.
- Trailing comments after closing delimiter lines.
- The supported `babel-ts` parser path.
- Idempotence, for example `format(format(input)) === format(input)`.

The hard-coded `expectedTestCount` in `test/index.test.mjs:9` is useful as a fixture guard, but it also makes adding new
fixtures a two-step update.

Suggested fixes:

- Add targeted fixtures for the bug repros above.
- Add a small idempotence assertion for each fixture.
- Add at least one `babel-ts` fixture if that parser remains advertised.

### Low: README.md is out of date

The README file is out of date.
