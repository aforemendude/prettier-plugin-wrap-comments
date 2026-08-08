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
