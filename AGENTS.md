# AGENTS.md

This is a Prettier plugin package named `@aforemendude/prettier-plugin-wrap-comments`. It wraps eligible JavaScript and
TypeScript comments as Markdown while leaving Prettier's built-in printers in charge of normal formatting.

- The plugin entry point is `src/index.ts`.
- Parser integration lives in `src/plugin/parsers.ts`. It wraps the `babel`, `babel-ts`, and `typescript` parsers and
  runs comment rewriting during parser preprocessing.
- Comment behavior lives in `src/comments/*`. Prefer changing this pipeline over touching printer behavior.
- Shared helpers live in `src/shared/*`.
- `dist/` is generated output. Do not edit it by hand; run `npm run build`.

## Development Commands

- Use Node.js 20 or newer.
- Run `npm run format:check` for formatting validation.
- Run `npm run typecheck` to type-check source, tests, and Vitest configuration.
- Run `npm run test` for behavior changes. Use `npm run test:unit` or `npm run test:integration` for one suite.
- Run `npm run verify` before publish-oriented changes. It runs formatting, type checking, the build, and tests.
- If npm tries to write to the read-only home cache in this environment, use a writable cache such as
  `npm_config_cache=/tmp/npm-cache`.

## TypeScript Rules

- Keep the strict compiler settings in `tsconfig.json`, including `strict` and `noUncheckedIndexedAccess`.
- This repo uses `module` and `moduleResolution` set to `nodenext`; internal TypeScript imports should use `.js`
  specifiers even when importing `.ts` source files.
- Fix type errors with explicit guards or narrower types. Do not loosen compiler options to make a change pass.

## Tests And Fixtures

- TypeScript unit tests live under `test/unit/` and import source modules directly.
- The Prettier integration harness is `test/integration/format.test.ts` and uses the fixtures under
  `test/integration/fixtures/`.
- Each fixture directory must contain exactly three files:
  - `config.json`
  - `original.<js|jsx|ts|tsx>.txt`
  - `expected.<js|jsx|ts|tsx>.txt`
- `test/integration/format.test.ts` has a hard-coded `expectedFixtureCount`. Increment it when adding a fixture and keep
  the exact file shape guard intact.
- JavaScript and JSX fixtures use the `babel` parser; TypeScript and TSX fixtures use the `typescript` parser. A fixture
  can override the inferred parser in `config.json`, as the `babel-ts` fixtures do.
- Keep integration fixtures ASCII-only. Cover non-ASCII cases in unit tests and write those characters with escapes
  instead of literals.
- Keep fixtures narrow and behavior-specific. If a fixture is meant to isolate comment wrapping, avoid unrelated long
  code lines that cause ordinary Prettier line breaking.

## Behavior And Documentation

- README behavior claims should be grounded in current source and fixtures, not stale prose.
- For README-only requests, stay documentation-only unless the user asks for behavior changes.
- Preserve the established skip rules for JSDoc, bang-preserved comments, TypeScript triple-slash comments, directive
  comments, and exact `prettier-ignore` handling unless the task explicitly changes them.
- Parser preprocessing intentionally returns the preprocessed source unchanged if parsing fails. Keep that failure mode
  stable unless the task specifically asks otherwise.
