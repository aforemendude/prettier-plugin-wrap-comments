# Code Review: Package Infrastructure

## Scope and review basis

Reviewed the repository's package, build, configuration, documentation, and test-infrastructure segment:

- `package.json` and `package-lock.json`
- `tsconfig.json`, `.gitignore`, `.prettierrc.json`, and `.vscode/settings.json`
- `README.md`, `CHANGELOG.md`, and `AGENTS.md`
- Test runner and fixture-harness setup in `test/*.test.mjs`, plus fixture file shapes and `config.json` structure where
  needed to assess the harness

The review used the current clean worktree as its basis. Generated `dist/`, dependency source, individual test cases,
fixture data, test logic and assertions, coverage adequacy, and formatting were excluded. Production source was
consulted only to validate package and documentation contracts.

## Findings

### 1. Build and test scripts depend on POSIX shell behavior

- **Severity:** Medium
- **References:** `package.json:45`, `package.json:49`
- **Problem:** The build script invokes `rm -rf`, and the test script passes the shell glob `test/*.test.mjs` to Node.
  npm uses `cmd.exe` by default on Windows, where `rm` is unavailable and the glob is not expanded as it is by POSIX
  shells. Because `test` invokes `build`, both `npm run test` and the `prepack`/`verify` chain fail before completing on
  a standard Windows installation even though the package declares only a Node.js version requirement.
- **Impact:** Windows contributors cannot use the documented build and test workflow, and a maintainer publishing from
  Windows cannot complete the configured prepack lifecycle without adding a separate Unix-like shell.
- **Recommendation:** Replace the removal command with a cross-platform Node filesystem command (or a declared
  cross-platform cleanup tool), and invoke the test runner without relying on shell glob expansion—for example, use
  Node's supported test discovery for the minimum declared Node version or explicitly enumerate the test files in a
  cross-platform runner script.

### 2. The declared MIT license is not accompanied by its license text

- **Severity:** Low
- **Reference:** `package.json:31` (no `LICENSE` or `LICENSE.md` file is present in the tracked repository)
- **Problem:** The manifest identifies the package as MIT-licensed, but the repository contains no copy of the MIT
  permission and copyright notice. Because the publish allowlist contains only `dist`, npm's special-file inclusion can
  include a license only if that file actually exists.
- **Impact:** Source and package consumers do not receive the license terms and notice that the MIT license expects
  copies or substantial portions to retain, and automated license/compliance tooling has less reliable evidence than a
  complete license file.
- **Recommendation:** Add a standard MIT license file with the applicable copyright holder and year, keep the SPDX
  `license` value, and confirm the file appears in `npm pack --dry-run` output before publishing.

### 3. Contributor instructions describe a fixture shape that rejects the repository's JSX and TSX fixtures

- **Severity:** Low
- **References:** `AGENTS.md:37`, `AGENTS.md:40-47`, `test/index.test.mjs:11-16`, `test/index.test.mjs:55-64`
- **Problem:** `AGENTS.md` says fixture source/expected files use only `<js|ts>` extensions and describes direct unit
  coverage as residing in `comments_core.test.mjs`. The harness explicitly accepts `js`, `jsx`, `ts`, and `tsx`, and the
  repository also has direct test modules for block comments, line comments, parser integration, and shared text
  helpers.
- **Impact:** Contributors following the repository instructions can incorrectly reject valid JSX/TSX fixture shapes or
  overlook the relevant direct-test module when maintaining a subsystem.
- **Recommendation:** Document all four accepted extensions and their parser mapping, and describe the direct test files
  generically or list the current modules rather than naming only `comments_core.test.mjs`.

### 4. README overstates how trailing-comment indentation is preserved

- **Severity:** Low
- **References:** `README.md:55-56`, validated against `src/comments/line.ts:140-149`
- **Problem:** The README says an overlong trailing line comment is moved above the code and wrapped using the code
  line's indentation. For a line composed of closing delimiters, the implementation deliberately adds one indentation
  level instead of using that line's indentation.
- **Impact:** Users configuring or evaluating the plugin can receive output at a different indentation level than the
  documented general rule, especially for comments trailing `}`, `]`, or `)` lines.
- **Recommendation:** Qualify the behavior description with the closing-delimiter exception and explain that those
  comments are indented one level so they remain visually inside the construct being closed.

### 5. The test workflow does not support the full declared Node.js engine range

- **Severity:** Low
- **References:** `package.json:11-12`, `package.json:49`, `README.md:6-9`, `AGENTS.md:19-24`
- **Problem:** The package and contributor documentation accept every Node.js 18 release, but the test script uses the
  `node --test` CLI flag, which was added in Node.js 18.1.0 according to the
  [official Node.js 18 CLI history](https://nodejs.org/download/release/v18.14.2/docs/api/cli.html#--test). Node.js
  18.0.x therefore satisfies the declared engine constraint while lacking the command needed by `npm run test` and,
  transitively, `verify` and `prepack`.
- **Impact:** A contributor or publisher using an allowed Node.js 18.0.x runtime cannot run the documented validation or
  package lifecycle successfully.
- **Recommendation:** Set the minimum engine and documented requirement to at least Node.js 18.1.0 (or a newer supported
  baseline), or rework the test launcher so it uses only functionality available throughout the stated range.

### 6. The publish-time verification command installs and can reconcile dependencies

- **Severity:** Low
- **References:** `package.json:48`, `package.json:50`, `README.md:160-161`, `AGENTS.md:24`
- **Problem:** `prepack` invokes `verify`, and `verify` begins with `npm install`. Unlike a check-only command,
  `npm install` is allowed to modify `package-lock.json` and the dependency tree to reconcile manifest drift. It also
  couples every pack or publish operation to dependency installation even when the maintainer already performed a clean
  bootstrap.
- **Impact:** A lockfile inconsistency can be repaired during verification instead of causing verification to fail,
  allowing packaging to proceed with dependency-state changes that were not separately reviewed or committed. The
  publish lifecycle also performs broader mutation than its name and documentation imply.
- **Recommendation:** Separate dependency bootstrap from validation: use `npm ci` as an explicit setup step where a
  clean install is required, make `verify` run only formatting/type/build/test checks against the installed locked
  dependencies, and keep `prepack` limited to that non-installing verification/build path.

## Unresolved questions

- `package.json:35` declares the open-ended peer range `prettier >=3.0.0`, while the lockfile validates development only
  against Prettier 3.8.3. Confirm whether compatibility with every future Prettier major is an intentional contract;
  otherwise cap the range before the next breaking major and widen it only after compatibility validation.

## Checks and areas not covered

- Confirmed the worktree was clean before creating this report.
- `./node_modules/.bin/tsc -p tsconfig.json --noEmit` completed successfully with the existing dependencies.
- A read-only manifest comparison confirmed that the package name, version, license, engine, development dependencies,
  and peer dependencies match the lockfile's root package metadata.
- A read-only fixture-shape check found 44 fixture directories, exactly one supported `original` file per directory,
  matching `expected` and `config.json` files, valid JSON object configs, and no shape mismatches.
- The Node.js 18 command-line documentation was checked to confirm that `--test` was introduced in 18.1.0 and that
  Node.js 18 accepts paths rather than internally expanding glob patterns.
- On the available Node.js 24.18.0 runtime, a quoted `node --test 'test/*.test.mjs'` probe internally discovered all six
  test modules but could not execute them because generated `dist/` was intentionally absent. This probe did not assess
  test behavior.
- Full build, test, format, install, and prepack commands were not run because the review skill permits report writes
  only; the configured build removes and regenerates `dist`, and `verify` installs dependencies.
- Individual test cases, fixture contents, assertions, and coverage adequacy were not reviewed.
