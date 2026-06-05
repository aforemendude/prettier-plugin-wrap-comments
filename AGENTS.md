# AGENTS.md

## Scope

These instructions apply to the whole repository.

## Project Shape

This is a Prettier plugin package named `@aforemendude/prettier-plugin-wrap-comments`. It wraps eligible JavaScript and
TypeScript comments as Markdown while leaving Prettier's built-in printers in charge of normal formatting.

- The plugin entry point is `src/index.ts`.
- Parser integration lives in `src/plugin/parsers.ts`. It wraps the `babel`, `babel-ts`, and `typescript` parsers and
  runs comment rewriting during parser preprocessing.
- Comment behavior lives in `src/comments/*`. Prefer changing this pipeline over touching printer behavior.
- Shared helpers live in `src/shared/*`.
- `dist/` is generated output. Do not edit it by hand; run `npm run build` or `npm run test`.

## Development Commands

- Use Node.js 18 or newer.
- Run `npm run format:check` for formatting validation.
- Run `npm run test` for behavior changes. This rebuilds `dist` before running the Node test suite.
- Run `npm run verify` before publish-oriented changes. It runs `npm install`, formatting checks, and tests.
- If npm tries to write to the read-only home cache in this environment, use a writable cache such as
  `npm_config_cache=/tmp/npm-cache`.

## TypeScript Rules

- Keep the strict compiler settings in `tsconfig.json`, including `strict` and `noUncheckedIndexedAccess`.
- This repo uses `module` and `moduleResolution` set to `nodenext`; internal TypeScript imports should use `.js`
  specifiers even when importing `.ts` source files.
- Fix type errors with explicit guards or narrower types. Do not loosen compiler options to make a change pass.

## Tests And Fixtures

- The fixture harness is `test/index.test.mjs`; direct unit coverage is in `test/comments_core.test.mjs`.
- Tests import the built plugin from `dist/index.js`, so run the build path before expecting source changes to appear in
  tests.
- Each fixture directory under `test/fixtures/` must contain exactly three files:
  - `config.json`
  - `original.<js|ts>.txt`
  - `expected.<js|ts>.txt`
- `test/index.test.mjs` has a hard-coded `expectedTestCount`. Increment it when adding a fixture and keep the exact file
  shape guard intact.
- JavaScript fixtures use the `babel` parser; TypeScript fixtures use the `typescript` parser. The harness infers this
  from the `original.<ext>.txt` filename.
- Keep fixtures narrow and behavior-specific. If a fixture is meant to isolate comment wrapping, avoid unrelated long
  code lines that cause ordinary Prettier line breaking.

## Behavior And Documentation

- README behavior claims should be grounded in current source and fixtures, not stale prose.
- For README-only requests, stay documentation-only unless the user asks for behavior changes.
- Preserve the established skip rules for JSDoc, bang-preserved comments, TypeScript triple-slash comments, directive
  comments, and exact `prettier-ignore` handling unless the task explicitly changes them.
- Parser preprocessing intentionally returns the preprocessed source unchanged if parsing fails. Keep that failure mode
  stable unless the task specifically asks otherwise.
