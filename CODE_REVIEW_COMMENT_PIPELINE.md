# Code Review: Comment Pipeline

## Scope and review basis

- **Reviewed scope:** `src/comments/**`, beginning at `src/comments/wrap-comments.ts` and following the production
  comment-rewrite data flow.
- **Supporting context inspected:** directly related parser integration, JSX rewrite metadata, AST traversal,
  display-width, indentation, Markdown formatting, replacement, source-line, whitespace, and option helpers; `README.md`
  behavior contracts and project configuration where needed to judge the selected scope.
- **Excluded:** generated `dist/**`, third-party source, formatting concerns, and individual test cases, assertions, and
  fixtures.
- **Review status:** complete. All modules in the selected scope were statically reviewed, their production call paths
  were traced through preprocessing and printing where needed, and the verified edge cases below were exercised against
  the current implementation. This does not imply that the reviewed code is defect-free beyond the reported evidence.

## Findings

### 6. Flow suppression and lint directives can be merged behind prose and disabled

- **Severity:** Medium
- **References:** `src/comments/comment-directives.ts:15-34`, `src/comments/comment-directives.ts:40-50`,
  `src/comments/line-comment-groups.ts:28-45`, `src/comments/wrap-line-comment-group.ts:23-33`
- **Problem:** The tool-directive list does not recognize Flow's `$FlowFixMe[...]`, `$FlowExpectedError[...]`,
  `flowlint`, `flowlint-line`, or `flowlint-next-line` comments. If an ordinary standalone comment immediately precedes
  one, line-group collection combines both bodies and Markdown reflow places the directive after the prose in the same
  comment. Current Flow suppression syntax expressly disallows text before the suppressor, and the lint forms are
  executable per-file/line configuration rather than prose ([Flow error suppressions](https://flow.org/en/docs/errors/),
  [Flowlint comments](https://flow.org/en/docs/linting/flowlint-comments/)).
- **Impact:** Formatting can disable a type-error suppression or Flow lint configuration and make a previously clean
  Flow check fail. Focused current-build probes rewrote `// explanation` followed by each of
  `// $FlowFixMe[incompatible-type]`, `// $FlowExpectedError[incompatible-type]`, and
  `// flowlint-next-line sketchy-null-bool:off` into a single `// explanation <directive>` line immediately before the
  target code.
- **Recommendation:** Add Flow suppressor and `flowlint(?:-line|-next-line)?` forms to directive classification so
  grouping stops before them and their text/placement is preserved. Include Flow's `@flow`/`@noflow` file pragmas in the
  same preservation policy even though fresh Babel parsing tolerates prose merged around those pragma tokens.

### 7. Unicode block-comment line separators are not normalized before Markdown parsing

- **Severity:** Medium
- **References:** `src/comments/comment-body.ts:18-20`, `src/comments/comment-body.ts:34-47`,
  `src/comments/wrap-block-comment.ts:39-46`, `src/utils/source-lines.ts:25-47`
- **Problem:** Source-line utilities consistently recognize U+2028 and U+2029 as JavaScript line terminators, but
  block-body normalization converts only CR/CRLF before splitting exclusively on `\n`. A conventional star-prefixed
  block containing either Unicode separator is therefore treated as one logical body line: only the outer trim runs, and
  per-line indentation/star removal never occurs before the text is passed to Markdown.
- **Impact:** Formatting corrupts comment structure and content. In focused Babel probes at `printWidth: 30`, a two-line
  `Alpha`/`Beta` conventional block joined with U+2028 or U+2029 was rewritten with `Alpha` as a Markdown list item,
  retained the second raw `*` prefix and Unicode separator inside a generated line, and wrapped `Beta` as list
  continuation text. This contradicts the pipeline's otherwise explicit Unicode-line-separator support.
- **Recommendation:** Normalize `\r\n`, lone `\r`, U+2028, and U+2029 to `\n` before splitting and per-line star
  removal. Use the same shared line-terminator normalization in Markdown input preparation so supported separators
  cannot take divergent paths.

### 8. Valid non-space JavaScript indentation makes wrapping non-idempotent

- **Severity:** Low
- **References:** `src/comments/comment-location.ts:8-16`, `src/comments/comment-location.ts:19-32`,
  `src/comments/wrap-comments.ts:137-148`, `src/comments/wrap-trailing-line-comment.ts:35-45`
- **Problem:** Standalone and adjacent-comment detection accepts only ASCII space and tab as indentation. JavaScript
  parsers also accept other non-line-breaking whitespace such as form feed, vertical tab, and no-break space. A comment
  preceded only by one of those characters is misclassified as trailing; the trailing wrapper then sees that the prefix
  trims to empty and skips it. Native Prettier removes the unusual whitespace, so the next plugin pass classifies the
  same comment as standalone.
- **Impact:** Formatting takes two passes to reach a stable result. Focused Babel probes with U+000B, U+000C, and U+00A0
  before an overlong line comment at `printWidth: 30` all left the comment unwrapped on the first pass and wrapped it to
  four lines on the second. This is a limited but reproducible editor/CI mismatch for valid source, including whitespace
  that can enter through copy/paste.
- **Recommendation:** Centralize an ECMAScript-horizontal-whitespace predicate and use it consistently for standalone
  checks and the indentation tail after an adjacent line terminator. Keep actual line terminators excluded from the
  indentation portion so blank lines do not become adjacent groups.

### 9. Neutralizing a block-form ignore marker permanently rewrites the marker and breaks the next pass

- **Severity:** Medium
- **References:** `src/comments/prettier-ignore.ts:18`, `src/comments/prettier-ignore.ts:20-34`,
  `src/plugin/create-parsers.ts:31-37`
- **Problem:** To let code after an ignored eligible block comment format normally,
  `neutralizePrettierIgnoreForIgnoredComments` replaces the preceding ignore comment node's `value`. Prettier prints a
  mutated block-comment value rather than recovering its original source spelling, so a standard `/* prettier-ignore */`
  marker is emitted as `/*prettier-ignore wrap-comments*/`. (The equivalent line-form marker happens to print from
  source unchanged.)
- **Impact:** The first format pass visibly destroys a user directive that the documented behavior promises to preserve.
  Because the emitted block is no longer an exact ignore marker, a second plugin pass wraps the target comment that the
  first pass deliberately left alone. A focused Babel probe changed the marker on pass one and changed its overlong
  target from one line to a multiline block on pass two.
- **Recommendation:** Do not encode transient ignore state by replacing the printable comment value. Track it out of
  band and either suppress Prettier's ignore association structurally or teach the printer to emit the exact original
  marker text while using separate metadata for ignore decisions. Add two-pass checks for both line- and block-form
  markers.

### 10. Trailing whitespace after a block ignore marker defeats adjacency detection

- **Severity:** Low
- **References:** `src/comments/comment-location.ts:19-32`, `src/comments/prettier-ignore.ts:80-98`,
  `src/comments/prettier-ignore.ts:20-34`
- **Problem:** `areCommentsOnAdjacentLines` permits indentation after the single line terminator but no spaces or tabs
  before it. Unlike line comments, a block comment's AST range ends at `*/`, so harmless trailing whitespace on a
  `/* prettier-ignore */   ` line remains in the inter-comment slice and makes an immediately following block target
  appear non-adjacent.
- **Impact:** The plugin wraps the block comment that the marker was meant to protect and fails to neutralize the
  marker, allowing native Prettier to ignore the following code as well. In a focused Babel probe, adding three trailing
  spaces to an otherwise working block marker changed the result from an untouched target plus normally formatted code
  to a rewritten target plus an irregular `const       x=1` line. Subsequent passes then behave differently after
  Prettier removes the spaces.
- **Recommendation:** Define adjacent comment lines as optional horizontal indentation, one supported line terminator,
  then optional indentation (`indent + newline + indent`), while still rejecting more than one line terminator.

### 11. Multiline wrapping silently disables Flow type-include comments

- **Severity:** Medium
- **References:** `src/comments/comment-eligibility.ts:15-24`, `src/comments/comment-body.ts:18-47`,
  `src/comments/wrap-block-comment.ts:35-46`, `src/comments/wrap-block-comment.ts:67-129`
- **Problem:** Flow's `/*:: ... */` and `/*flow-include ... */` forms contain type syntax that Flow includes in the
  checked program while JavaScript treats it as a comment
  ([Flow comment types](https://flow.org/en/docs/types/comments/)). Eligibility does not preserve either raw prefix.
  When a standalone include is long enough to expand, the generated conventional block inserts `*` before
  `::`/`flow-include`, so Flow no longer recognizes the include.
- **Impact:** In a Flow-checked file, formatting can silently remove declarations from Flow's view and weaken type
  checking while leaving runtime JavaScript valid. In focused probes at `printWidth: 35`, explicit `babel-flow` parsing
  of each original long include produced a `TypeAlias` plus the runtime declaration; parsing the plugin output produced
  only the runtime declaration. The output gave no error or warning that the type alias had disappeared.
- **Recommendation:** Raw-prefix-skip all accepted Flow comment-type forms before Markdown normalization, including the
  single-colon annotation shorthand, double-colon includes, and `flow-include` (with the whitespace variants Flow
  accepts). These comments must remain byte-structurally compatible with Flow rather than merely readable as prose.

### 12. Same-line replacements make the precomputed trailing-comment layout stale

- **Severity:** Medium
- **References:** `src/comments/wrap-comments.ts:60-68`, `src/comments/wrap-comments.ts:104`,
  `src/comments/wrap-comments.ts:148-152`, `src/comments/wrap-comments.ts:167-170`,
  `src/comments/wrap-block-comment.ts:74-81`, `src/comments/wrap-trailing-line-comment.ts:31-33`,
  `src/comments/wrap-trailing-line-comment.ts:92-106`
- **Problem:** The pipeline probes one native-printer layout before scheduling any replacements, then independently
  decides block and trailing-line rewrites against that snapshot and applies everything only at the end. Normalizing an
  inline block on the same line can change its width, but `wrapTrailingLineComment` still trusts the original
  `outputLayout.lineWidth`.
- **Impact:** Width growth makes formatting non-idempotent: at `printWidth: 40`,
  `const value = /*x*/ thing; // word word` probes as 39 columns, then block normalization produces a 41-column
  first-pass line; only pass two moves the trailing comment. Width shrinkage makes the opposite decision permanently
  over-eager: a space-padded inline block plus `// word` was probed over width, so the comment moved above even though
  simultaneous block normalization made the combined line short enough to fit.
- **Recommendation:** Use a two-phase rewrite/layout pass when accepted replacements can affect another comment's output
  line, or adjust the probed line width by the exact deltas of accepted same-line replacements before making
  trailing-comment decisions. Verify both growing and shrinking inline-block cases in a one-pass/idempotence check.

### 13. Node test coverage control comments are reformatted into an unrecognized shape

- **Severity:** Medium
- **References:** `src/comments/comment-directives.ts:15-34`, `src/comments/comment-directives.ts:40-50`,
  `src/comments/comment-eligibility.ts:15-24`, `src/comments/wrap-block-comment.ts:35-46`,
  `src/comments/wrap-block-comment.ts:80-129`
- **Problem:** Node's test runner defines executable block comments `/* node:coverage disable */`, `enable`, and
  `ignore next [N]` to control coverage collection
  ([Node test coverage documentation](https://nodejs.org/api/test.html#collecting-code-coverage)). The coverage-oriented
  directive list includes several other tools but not `node:coverage`, so a directive that does not fit is expanded to a
  star-prefixed block with `node:coverage` and its command on separate lines. Node no longer recognizes that shape.
- **Impact:** Formatting changes which code is counted as uncovered and can break coverage thresholds. A focused Node 24
  coverage run reported 100% for a module whose uncalled function was enclosed by canonical disable/enable comments; the
  otherwise identical plugin-expanded directives produced 86.67% line and 50% function coverage with the function
  reported uncovered. At `printWidth: 20`, all four documented forms were expanded; the disable/enable pair was
  demonstrably no longer effective.
- **Recommendation:** Classify the exact `node:coverage disable`, `enable`, and `ignore next` forms (including the
  optional positive line count) as directives and preserve them verbatim. Treat coverage-control syntax as semantic
  regardless of configured width or indentation.

### 14. One Markdown pass exposes an upstream thematic-rule fixed-point change

- **Severity:** Low
- **References:** `src/utils/format-markdown.ts:7-27`, `src/comments/wrap-line-comment-group.ts:23-42`,
  `src/comments/wrap-block-comment.ts:39-46`, `src/comments/wrap-block-comment.ts:126-129`
- **Problem:** The pinned Prettier Markdown formatter takes two calls to stabilize an extracted fragment consisting of a
  thematic rule, paragraph, and thematic rule. `formatMarkdownLines` returns after one call, so both line and block
  wrappers expose the intermediate output rather than a fixed point. This originates in the dependency's
  Markdown/front-matter ambiguity, but the plugin feeds comment fragments into that parser and publishes the unstable
  intermediate form.
- **Impact:** A normal Markdown comment is not idempotent across formatting runs. For `// ***`, `// paragraph words`,
  `// ***`, pass one changed the rules to `---` and inserted blank `//` lines around the paragraph; pass two removed
  both blank comment lines, and pass three was stable. The same occurred for a conventional block comment and for all
  three supported parsers across widths 20-80.
- **Recommendation:** Canonicalize the thematic-rule/front-matter ambiguity before rebuilding comments, or use a
  narrowly triggered bounded fixed-point pass with equality/cycle guards. Avoid an unconditional second Markdown call,
  which would compound the per-comment performance problem already noted above.

## Unresolved questions

- None.

## Checks and areas not covered

- `npm run typecheck` completed successfully.
- `npm run test` completed successfully: 30 files and 235 tests passed.
- Focused current-implementation probes covered one-pass and repeated formatting with all supported parsers; JSX ignore
  behavior; embedded JSX/template comments; block-form ignore markers; Unicode separators and ECMAScript whitespace;
  same-line replacement interactions; Flow suppressors and type includes; Markdown thematic rules; and native-Prettier
  comparisons. The generated runtime files were used only after comparison with a temporary source compilation showed no
  JavaScript differences.
- Focused scaling probes covered serial Markdown formatting, JSX/container lookup, and `prettier-ignore` range lookup. A
  Node 24 test-coverage run verified the `node:coverage` impact.
- Generated output, third-party implementation source, individual test logic/assertions/fixtures, and formatting
  concerns were not reviewed. A production build was not run because generated `dist/**` is outside scope.
