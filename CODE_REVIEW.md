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
