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

- `npm run test` passed: 43 tests.
- `npm run format:check` passed.
- `npm pack --dry-run --json` initially failed because npm tried to write to `/home/sudoer/.npm`.
- `npm_config_cache=/tmp/npm-cache npm pack --dry-run --json` passed and included `README.md`, `package.json`, and built
  `dist` files.

## Addressed Items

### 1. Multiline block-comment leading stars are comment formatting

Decision: expected behavior. `normalizeBlockCommentBody` treats a `*` that is the first non-whitespace character on a
multiline block-comment body line as decorative block-comment formatting, not Markdown content. This behavior is now
documented in `README.md`.

### 2. Block-form `prettier-ignore` before closing-delimiter trailing comments

Fixed. Exact-body block-form `/* prettier-ignore */` markers now behave like `// prettier-ignore` markers in the special
trailing-comment path for closing delimiter lines.

Coverage added:

- Object closing delimiter with block-form `prettier-ignore`.
- Block closing delimiter with block-form `prettier-ignore`.
- Call closing delimiter with block-form `prettier-ignore`.

## Testing Gaps

### Prettier-ignore behavior

Existing fixtures cover several important ignore cases, including ignored nodes, trailing line comments, closing
delimiters with `// prettier-ignore`, and block-form ignores before ordinary code lines and closing delimiters.

Missing cases:

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

1. Add direct unit tests for normalization and replacement helpers.
2. Expand parser, JSX/TSX, end-of-line, and directive coverage after the confirmed defects are covered.
