# TODO

Review date: 2026-06-05

Scope reviewed:

- `src/plugin/*`
- `src/comments/*`
- `src/shared/*`
- `test/*.test.mjs`
- `test/fixtures/*`
- `README.md`, `CHANGELOG.md`, `package.json`, `tsconfig.json`

Verification run:

- `npm run test` passed: 40 tests.
- `npm run format:check` passed.
- `npm pack --dry-run --json` initially failed because npm tried to write to `/home/sudoer/.npm`.
- `npm_config_cache=/tmp/npm-cache npm pack --dry-run --json` passed and included `README.md`, `package.json`, and built
  `dist` files.

## Confirmed Bugs

### 1. Unstarred multiline block comments can lose Markdown syntax

Severity: High

Affected code:

- `src/comments/core.ts:47`
- `src/comments/core.ts:63`
- `src/comments/core.ts:67`

`normalizeBlockCommentBody` strips all leading indentation from every multiline block-comment body line. If the first
non-whitespace character is `*`, it also treats that character as a decorative block-comment marker. That is correct for
standard star-prefixed comments such as:

```text
/*
 * Text
 */
```

It is incorrect for unstarred block comments that use meaningful Markdown indentation or `*` syntax.

Repro:

```text
/*
  * first item has a very long description that should keep the markdown bullet marker intact
  * second item
*/
const value = 1;
```

Actual output:

```text
/*
 * first item has a very long description
 * that should keep the markdown bullet
 * marker intact second item
 */
const value = 1;
```

The Markdown bullet markers are removed, and the two list items collapse into one paragraph.

Other confirmed corruptions:

- An unstarred nested list loses nesting because leading spaces are stripped:

  ```text
  /*
  - parent item
    - nested child item
  */
  ```

  The child becomes a top-level list item.

- An unstarred indented code block loses its code indentation:

  ```text
  /*
  Here is an example:

      const value = computeSomethingVeryLong();
  */
  ```

  The code line becomes normal paragraph text.

- An unstarred emphasis line starting with `**Important:**` loses the first `*`, causing Prettier Markdown to escape and
  reflow malformed Markdown.

Suggested fix:

- Detect whether a multiline block comment is actually using decorative star prefixes before removing leading `*`.
- For unstarred comments, strip only a common indentation prefix rather than all indentation.
- Preserve Markdown-significant indentation after dedenting.
- Keep the existing behavior for standard star-prefixed block comments.

Tests to add:

- Fixture for unstarred multiline block comments with `*` unordered lists.
- Fixture for unstarred nested Markdown lists.
- Fixture for unstarred indented code blocks.
- Unit tests for `normalizeBlockCommentBody`.
- Regression coverage proving standard `*`-prefixed block comments still normalize correctly.

### 2. Block-form `prettier-ignore` is not honored before closing-delimiter trailing comments

Severity: Medium

Affected code:

- `src/comments/wrap.ts:464`
- `src/comments/wrap.ts:490`
- `src/comments/wrap.ts:494`

The suite has fixtures for `// prettier-ignore` before closing-delimiter trailing comments, and those comments stay
inline. Equivalent block-form markers are not handled by the special trailing-comment path.

Repro:

```text
const config = {
  value: 1,
  /* prettier-ignore */
};   // This comment describes the completed config object and should stay inline when block-form prettier-ignore is directly above the closing delimiter.
```

Actual output:

```text
const config = {
  value: 1,
  /* prettier-ignore */
  // This comment describes the completed config object
  // and should stay inline when block-form
  // prettier-ignore is directly above the closing
  // delimiter.
};
```

The same behavior reproduces for `}` after a block body and `)` after a call expression.

Decision needed:

- If exact-body block-form `/* prettier-ignore */` should behave like `// prettier-ignore`, extend
  `isPrettierIgnoredTrailingLineComment` to recognize standalone block comments too.
- If this is intentionally line-only for closing delimiters, document that limitation in `README.md`.

Tests to add if block-form support is desired:

- Fixture for an object closing delimiter with block-form `prettier-ignore`.
- Fixture for a block closing delimiter with block-form `prettier-ignore`.
- Fixture for a call closing delimiter with block-form `prettier-ignore`.

## Testing Gaps

### Block-comment normalization

Current fixtures cover star-prefixed Markdown lists, but not unstarred Markdown with meaningful leading syntax.

Add coverage for:

- Unstarred `*` list items.
- Unstarred nested lists.
- Unstarred indented code blocks.
- Unstarred emphasis that starts at the first non-whitespace character.
- Mixed star-prefixed and unstarred block-comment styles.
- Blank lines at the beginning, middle, and end after dedenting.

### Prettier-ignore behavior

Existing fixtures cover several important ignore cases, including ignored nodes, trailing line comments, closing
delimiters with `// prettier-ignore`, and block-form ignores before ordinary code lines.

Missing cases:

- Block-form ignores before closing delimiters.
- `prettier-ignore` before decorated declarations, exported declarations, class fields, enum members, and object
  properties.
- `prettier-ignore` around JSX and TSX trees with nested expression comments.
- A direct test for the documented parser-preprocess failure mode: invalid source should return unchanged from
  `preprocess`.
- A behavior decision and fixture for `prettier-ignore` before standalone line comments, since standalone block comments
  already get special handling.

### Parser matrix

The fixtures exercise:

- `babel` through `.js` and `.jsx`
- `typescript` through `.ts` and `.tsx`
- `babel-ts` for a line-comment fixture

Missing parser coverage:

- `babel-ts` for block comments.
- `babel-ts` for trailing line comments.
- `babel-ts` for `prettier-ignore`.
- `babel-ts` for JSX/TSX-shaped expression comments if that parser is expected to support them.

### JSX and TSX expression comments

Current fixtures cover comment-only expressions, trailing expression comments, and true inline expression comments.

Add coverage for:

- Fragments.
- Nested JSX expression containers.
- JSX attributes whose expression contains comments.
- Conditional and logical expressions with leading, trailing, and inline comments.
- Comments with tabs or non-default `tabWidth` inside JSX.
- `prettier-ignore` around JSX subtrees containing eligible comments.

### Replacement and offset handling

`applyReplacements` has one regression fixture for overlapping block and trailing comments, but little direct unit
coverage.

Add unit tests for:

- Contained overlapping replacements.
- Adjacent replacements that should both apply.
- Multiple insertions at the same offset.
- Replacements emitted out of order.
- A wider replacement that should win over a nested replacement.

### End-of-line handling

README says `endOfLine` is used when rebuilding comments. The tests do not cover this directly.

Add coverage for:

- `endOfLine: "lf"`
- `endOfLine: "crlf"`
- `endOfLine: "cr"`
- `endOfLine: "auto"` with existing CRLF input
- Standalone line comments, trailing line comments, and multiline block comments for each relevant newline mode

### Markdown shapes

Existing tests mostly cover paragraphs and lists.

Add fixtures for:

- Fenced code blocks.
- Blockquotes.
- Inline code.
- Long URLs.
- Markdown links.
- Tables, if table preservation matters.
- Non-ASCII text and full-width characters if visual column width matters for this plugin.

### Directive preservation

Unit tests cover many directive patterns, but fixture coverage is thinner.

Add fixture coverage for directive comments in these positions:

- Standalone line comments.
- Trailing line comments.
- Standalone block comments.
- Inline block comments.
- JSX expression comments.

Also consider whether additional common directives should be skipped, such as Flow pragmas or generated-file markers. If
they should not be skipped, document that.

### Tooling and packaging

The package dry-run passes with `npm_config_cache=/tmp/npm-cache`, but the default `npm pack --dry-run --json` path
failed in this environment because npm used the read-only home cache.

Options:

- Leave this as an environment note only.
- Document the writable-cache workaround in development docs.
- Add a CI/package validation script that sets a writable cache in this environment.

## Recommended Order

1. Fix block-comment normalization first. It is a content-corruption bug.
2. Decide and either fix or document block-form `prettier-ignore` before closing delimiters.
3. Add focused regression fixtures for both confirmed bugs.
4. Add direct unit tests for normalization and replacement helpers.
5. Expand parser, JSX/TSX, end-of-line, and directive coverage after the confirmed defects are covered.
