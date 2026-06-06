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

Latest verification run:

- 2026-06-06: `npm run test` passed: 67 tests.
- 2026-06-06: `npm run format:check` passed.

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

### 3. Testing gap coverage pass

Fixed. Added representative unit and fixture coverage for the open testing gaps identified in this review.

Coverage added:

- Direct unit tests for `normalizeBlockCommentBody`.
- Direct unit tests for `applyReplacements`, including contained overlaps, adjacent replacements, same-offset
  insertions, out-of-order replacements, and wider-over-nested replacement precedence.
- Direct unit tests for `getPreferredNewline`.
- Wrapper-level newline tests for standalone line comments, trailing line comments, and multiline block comments.
- A direct parser-preprocess failure-mode test confirming invalid source returns unchanged.
- `prettier-ignore` fixtures for decorated declarations, exported declarations, class fields, enum members, object
  properties, JSX/TSX subtrees, and standalone line-comment groups.
- `babel-ts` fixtures for block comments, trailing line comments, and `prettier-ignore`.
- JSX/TSX fixtures for fragments, nested JSX expression containers, JSX attribute expressions, conditional/logical
  expression comments, tabs, and non-default `tabWidth`.
- Markdown fixtures for fenced code blocks, blockquotes, inline code, long URLs, Markdown links, and tables.
- Directive-preservation fixtures for standalone line comments, trailing line comments, standalone block comments,
  inline block comments, and JSX expression comments.

### 4. `prettier-ignore` before standalone line comments

Decision: a line-form `// prettier-ignore` immediately before an eligible standalone line-comment group applies to that
comment group. The comment group remains source-faithful, and the marker is neutralized during parse so the following
code still formats normally.

Coverage added:

- Standalone line-comment fixture proving the comment stays unwrapped.
- Assertion that the following code line still formats after the marker is consumed by the comment group.

## Remaining Testing Follow-ups

The broad gaps from this review now have representative coverage. Remaining possible follow-ups are policy or exhaustive
matrix choices rather than confirmed high-priority gaps:

- Add an exhaustive end-of-line fixture matrix if byte-level fixture coverage for every `endOfLine` mode and every
  comment shape is needed. Current unit tests cover newline selection and wrapper-level application.
- Add non-ASCII and full-width character fixtures if the plugin decides to account for display width beyond JavaScript
  string columns.
- Decide whether additional common directives should be skipped, such as Flow pragmas or generated-file markers. If they
  should not be skipped, document that.
- Add `babel-ts` JSX/TSX-shaped expression-comment coverage only if `babel-ts` is expected to be a supported JSX/TSX
  parser surface. Current JSX/TSX fixtures exercise `babel` and `typescript`.

### Tooling and packaging

The package dry-run passes with `npm_config_cache=/tmp/npm-cache`, but the default `npm pack --dry-run --json` path
failed in this environment because npm used the read-only home cache.

Options:

- Leave this as an environment note only.
- Document the writable-cache workaround in development docs.
- Add a CI/package validation script that sets a writable cache in this environment.

## Recommended Order

1. Decide whether Flow pragmas or generated-file markers should be skipped or documented as ordinary comments.
2. Add non-ASCII/full-width fixtures if visual display width becomes part of the plugin's behavior contract.
3. Add a package-validation script with a writable npm cache if publish validation needs to be environment-independent.
