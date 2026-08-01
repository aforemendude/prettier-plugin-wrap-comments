# Code Review: Plugin Integration

## Scope and review basis

Review status: complete.

Reviewed scope:

- `src/index.ts`
- `src/plugin/parsers.ts`
- `src/plugin/printers.ts`
- `src/shared/options.ts`
- directly related types, helpers, call sites, package metadata, configuration, and documentation needed to verify the
  integration contracts

Generated output, third-party source, individual test cases and fixtures, formatting, and coverage adequacy are out of
scope. The review is based on the current clean worktree, the repository instructions, source code, package metadata,
TypeScript configuration, installed Prettier API/type contracts, and focused read-only checks.

The segment is divided into these milestones:

1. Public exports and option contracts.
2. Parser wrapping and preprocessing flow.
3. Printer delegation and JSX comment handling.

## Findings

### 1. Source-rewriting preprocessing breaks cursor and range offsets

- **Severity:** Medium
- **Location:** `src/plugin/parsers.ts:17-28`
- **Problem:** The parser `preprocess` hook rewrites comments with `wrapComments`, which can add or remove characters
  before `cursorOffset`, `rangeStart`, or `rangeEnd`, but it returns only the rewritten string and does not remap those
  offsets. Prettier continues using the offsets normalized from the original input against the rewritten source.
- **Impact:** `prettier.formatWithCursor` can return a cursor position on the wrong token, and range formatting can
  select and reformat nodes outside the requested original range. The preprocessing pass also rewrites eligible comments
  outside a requested range. In a focused check with a long comment before two declarations, the plugin returned cursor
  offset 155 while the intended position in the formatted output was 164; a range aimed at the second declaration also
  formatted the preceding declaration and rewrote the earlier comment.
- **Recommendation:** Preserve source length and offsets during parser preprocessing, or add an explicit offset-mapping
  strategy for cursor and range operations. If Prettier's parser hook cannot express that mapping, detect non-default
  cursor/range requests and avoid length-changing comment rewrites outside a safely mapped full-file operation; document
  any unavoidable API limitation.

### 2. A valid zero tab width can crash comment formatting

- **Severity:** Medium
- **Location:** `src/shared/options.ts:14-15`; `src/shared/text.ts:92-101`; `src/shared/text.ts:131-138`
- **Problem:** `getTabWidth` accepts any numeric value, including Prettier's supported `tabWidth: 0`. Column measurement
  then performs modulo by zero for source tabs, and `makeIndent` divides a positive column by zero before passing
  `Infinity` to `String.prototype.repeat` when `useTabs` is enabled.
- **Impact:** Valid Prettier configuration can make the plugin either calculate `NaN` widths and silently skip wrapping
  or abort formatting. A focused closing-delimiter trailing-comment check succeeded with base Prettier using
  `tabWidth: 0` and `useTabs: true`, but failed with the plugin with `RangeError: Invalid count value: Infinity`.
- **Recommendation:** Define explicit zero-width behavior before doing tab arithmetic. For example, use a nonzero
  effective width for the plugin's column and indentation calculations while preserving the original option passed to
  Prettier, and guard all division/modulo operations against zero. Verify that tab-containing input and generated tab
  indentation remain deterministic for this valid option value.

### 3. The JSX printer override changes comments that wrapping explicitly skips

- **Severity:** Low
- **Location:** `src/plugin/printers.ts:18-22`; `src/plugin/printers.ts:28-51`; `README.md:136-144`
- **Problem:** `isMultilineEmptyJsxExpressionBlockComment` matches every multiline block comment in an empty JSX
  expression, without distinguishing comments expanded by this plugin from JSDoc, bang-preserved, directive, or other
  comments that the wrapping pipeline intentionally skips. The custom branch then bypasses the built-in estree printer
  and forces the surrounding braces onto separate lines.
- **Impact:** Merely enabling the plugin changes normal Prettier layout for unsupported/preserved comment categories,
  contrary to the README's statement that those comments are left unchanged. For example, installed Prettier prints an
  existing multiline JSDoc expression with the opening brace and comment together, while the plugin puts `{`, the
  untouched JSDoc, and `}` on separate lines. Multiline `/*! ... */` and directive blocks behave the same way, creating
  unrelated diffs in code the plugin promises not to wrap.
- **Recommendation:** Limit the custom JSX printer branch to comments actually expanded by the preprocessing pipeline,
  such as by carrying explicit rewrite metadata through a supported mechanism or by using a predicate that uniquely
  identifies the generated layout. Delegate skipped and pre-existing multiline comments to `estreePrinter.print`.

### 4. Named parser and printer exports are incorrectly typed as optional

- **Severity:** Low
- **Location:** `src/index.ts:6-13`; `src/plugin/parsers.ts:33`; `src/plugin/printers.ts:10`
- **Problem:** Both builders always return object literals, but their return annotations use the optional indexed types
  `Plugin['parsers']` and `Plugin['printers']`. That `undefined` union propagates to the explicitly exported `parsers`
  and `printers` declarations.
- **Impact:** The published declaration requires TypeScript consumers of the named exports to handle `undefined` even
  though runtime initialization cannot produce it, and it loses useful precision about the actual public maps. The
  isolated declaration emit produced `{ [parserName: string]: Parser<any> } | undefined` and
  `{ [astFormat: string]: Printer<any> } | undefined` for these exports.
- **Recommendation:** Give each builder a non-optional return type, such as `NonNullable<Plugin['parsers']>` and
  `NonNullable<Plugin['printers']>`, or preserve an inferred concrete object type while using `satisfies` to check
  compatibility with Prettier's plugin contract.

### 5. Every normally parsed nonempty file is parsed twice even when it has no comments

- **Severity:** Medium
- **Location:** `src/plugin/parsers.ts:12-28`
- **Problem:** The wrapper performs a full underlying parse during `preprocess` to discover comments, then Prettier
  invokes the wrapper's `parse` method and parses the returned source a second time. There is no inexpensive early exit
  for nonempty text that cannot contain a JavaScript or TypeScript comment, so comment-free sources that reach
  Prettier's normal formatting and parsing path pay for both parses.
- **Impact:** Formatting latency is close to doubled for parse-dominated files, including files on which the plugin can
  do no work. In an eight-run warm comparison on a generated 5,000-line, comment-free TypeScript source, installed
  Prettier 3.8.3 had a median of approximately 902 ms while the plugin had a median of approximately 1,756 ms in the
  same process. This overhead directly affects editor formatting and repository-wide format runs.
- **Recommendation:** Before the speculative parse, add a safe lexical impossibility check that returns immediately when
  the preprocessed text contains neither `//` nor `/*`. For comment-bearing files, investigate an architecture that
  reuses parser work or transforms comment data after Prettier's required parse; benchmark the chosen approach on
  representative JavaScript and TypeScript inputs.

## Unresolved questions

None.

## Checks and areas not covered

- Confirmed the worktree was clean before creating this report with `git status --short`.
- Compared `prettier.formatWithCursor` and range-formatting behavior with and without the plugin using an isolated
  temporary TypeScript build against the installed Prettier 3.8.3 package. This verified finding 1 without generating
  repository output.
- Confirmed from Prettier's installed support metadata that `tabWidth` has a valid range beginning at zero, then
  compared base and plugin behavior for `tabWidth: 0`/`useTabs: true` to verify finding 2.
- Compared native and plugin JSX output for normal wrapped comments and pre-existing multiline JSDoc, bang-preserved,
  and directive comments; repeated formatting was idempotent, but the first plugin pass verified the out-of-scope layout
  changes in finding 3.
- Emitted declarations to an isolated temporary directory and inspected the public entry-point types to verify finding
  4; repository `dist/` was not created or changed.
- Benchmarked eight warm base/plugin pairs on an in-memory, 5,000-line comment-free TypeScript source to verify the
  repeated-parse impact in finding 5. Timing is environment-specific, but the two parse calls are directly established
  by the source flow.
- Ran `tsc -p tsconfig.json --noEmit` successfully and completed in-memory formatting smoke checks for the `babel`,
  `babel-ts`, and `typescript` parser exports. The default export and named parser/printer exports referenced the same
  runtime maps.
- Runtime behavior was checked only with the installed Prettier 3.8.3 dependency. Compatibility with other versions
  admitted by the `>=3.0.0` peer range and composition with unrelated third-party parser/printer plugins were not
  exercised because the review did not install dependencies.
- The repository test suite was not run because its configured command rebuilds `dist/`; generating repository output is
  outside this report-only review. Individual test cases, fixtures, assertions, and coverage adequacy were intentionally
  not reviewed.
- Generated `dist/` output and third-party implementation source were not reviewed.
- No dependencies were installed or updated.
