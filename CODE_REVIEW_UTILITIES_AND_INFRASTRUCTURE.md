# Code Review: Utilities and Infrastructure

## Scope and review basis

Reviewed `src/utils/**`; `package.json`; `package-lock.json`; `tsconfig.json`; `tsconfig.build.json`;
`vitest.config.ts`; `scripts/**`; `.prettierrc.json`; `.gitignore`; `.vscode/settings.json`; the configuration and
harness behavior in `test/integration/format.test.ts` and `test/integration/offsets.test.ts`; and the behavior/setup
contracts in `README.md`, `CHANGELOG.md`, and `AGENTS.md`. Production comment and plugin modules were inspected only as
needed to trace utility call sites and validate documented contracts.

The review excludes generated `dist/**`, third-party source, formatting concerns owned by the repository formatter,
individual test cases and assertions, fixture contents, and `CODE_REVIEW_PERFORMANCE.md`.

Review basis: the clean worktree observed before report creation, static tracing of utility consumers and setup
contracts, package-lock and installed-package metadata, and the focused checks listed below.

## Findings

### 1. Development Node requirement understates the pinned toolchain minimum

- **Severity:** Low
- **References:** `package.json:12`, `package.json:15-16`, `package-lock.json:1542-1559`, `README.md:6-9`,
  `AGENTS.md:16-24`
- **Problem:** The package engine and both setup documents permit every Node 20 release (`>=20.0.0` / “Node.js 20 or
  newer”), but the directly pinned Vite 8.1.5 development dependency declares `^20.19.0 || >=22.12.0`. The installed
  package metadata agrees with the lockfile.
- **Impact:** A contributor using Node 20.0 through 20.18, Node 21, or Node 22.0 through 22.11 satisfies the
  repository's stated requirement while running an unsupported test toolchain. An engine-strict install rejects that
  dependency; a default npm install only warns and can defer the failure or incompatibility until development commands
  run.
- **Recommendation:** State and enforce Vite's actual development range (`^20.19.0 || >=22.12.0`), or choose a simpler
  supported floor such as Node 22.12 and enforce it with a checked-in version-manager declaration; alternatively, pin a
  Vite version that supports the advertised range. If consumers genuinely remain supported on Node 20.0, distinguish the
  package runtime engine from the contributor/toolchain requirement instead of unnecessarily narrowing both.

### 2. Fixture configuration can replace the plugin under test

- **Severity:** Low
- **Reference:** `test/integration/format.test.ts:41-46`
- **Problem:** The harness creates `options` with `plugins: [plugin]` and then spreads the fixture's parsed JSON over
  that value. Consequently, any fixture containing a `plugins` key replaces the local plugin instead of merely adding
  fixture-specific Prettier options. Parser replacement is an intentional fixture feature documented in `AGENTS.md`, but
  plugin replacement is neither constrained nor merged.
- **Impact:** A fixture that adds another plugin, or accidentally supplies an empty plugin list, can stop exercising the
  repository plugin. In particular, an unchanged/skip-behavior fixture can still pass against plain Prettier and provide
  a false integration signal without making the harness failure obvious.
- **Recommendation:** Keep parser override support but guarantee that the local plugin remains in the final plugin list.
  Either reject a `plugins` property in fixture JSON or merge fixture plugins explicitly and append the imported local
  plugin after applying the remaining config.

## Reviewed segments with no findings

- `src/utils/**`: no verified findings. This statement does not imply the segment is defect-free.
- `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`, `scripts/clean.mjs`, `.prettierrc.json`, `.gitignore`,
  `.vscode/settings.json`, `test/integration/offsets.test.ts`, and `test/unit/support/**`: no additional verified
  findings. This statement does not imply these areas are defect-free.

## Unresolved questions

None.

## Checks and areas not covered

- Confirmed the worktree was clean with `git status --short` before creating this report.
- Traced every exported utility to its production call sites under `src/comments/**` and `src/plugin/**`.
- `npm run typecheck` passed.
- `npm exec -- tsc -p tsconfig.build.json --noEmit` passed, validating the build-specific compiler configuration without
  writing generated output.
- `npm exec -- vitest run test/unit/utils` passed (9 files, 44 tests).
- `npm run test:integration` passed (2 files, 54 tests).
- `node --check scripts/clean.mjs` passed.
- `npm ls --depth=0` reported the expected direct dependency tree; Vite's installed metadata and lockfile both declare
  the narrower Node engine recorded in Finding 1.
- `npm audit --json` reported zero known vulnerabilities in the current lockfile dependency graph.
- `npm pack --dry-run --ignore-scripts --json` passed when run with the repository-documented writable npm cache. The
  first attempt could not use the environment's read-only home cache; no dependency was installed or changed.
- Checks ran with Node 24.18.0 and npm 11.16.0. The incompatible-but-documented Node versions in Finding 1 were not
  available for runtime testing; the mismatch was verified from both locked and installed package metadata.
- `npm run build` and the full `npm run verify` chain were not run because the build deliberately deletes and recreates
  generated `dist/**`, while this review permits only report-file workspace modifications. Build configuration was
  checked with the no-emit command above instead.
- Generated output, third-party source, individual test/fixture behavior, and formatter-owned presentation are not
  covered.
