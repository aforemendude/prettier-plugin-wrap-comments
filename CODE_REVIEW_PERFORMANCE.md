# Formatting every comment as a separate Markdown document scales poorly

- **Severity:** Medium
- **Location:** `src/comments/wrap-comments.ts:42-118`, `src/comments/wrap-line-comment-group.ts:23-46`,
  `src/comments/wrap-trailing-line-comment.ts:35-48`, `src/comments/wrap-block-comment.ts:39-56`, and
  `src/utils/format-markdown.ts:7-27`
- **Problem:** The main loop awaits a separate full `prettier.format(..., { parser: 'markdown' })` call for every
  eligible line-comment group and block comment, including short, already-normalized prose that produces no replacement.
  The work is strictly per group and serial, so formatter parsing/printing overhead grows linearly with comment count in
  addition to the JavaScript parsing cost.
- **Impact:** Comment-heavy files incur material interactive latency. On Node 24.18.0 with the repository's Prettier
  3.8.3, five warmed public-path runs over 200 separated short comments had median totals of about 106 ms with the
  plugin versus 6 ms with vanilla Prettier; 500 comments measured about 220 ms versus 11 ms. An isolated loop around
  `formatMarkdownLines` accounted for roughly 95 ms and 199 ms at those counts, respectively. These synthetic timings
  are environment-specific, but they confirm that unchanged short comments pay the dominant repeated cost.
- **Recommendation:** Add a semantics-preserving fast path for already-normalized single-line prose that fits and
  contains no Markdown constructs requiring parsing, and cache identical body/width/option combinations. For remaining
  comments, investigate safe batching or another way to amortize Markdown parser/printer setup, then benchmark
  comment-count scaling as part of the change.

# Every normally parsed nonempty file is parsed twice even when it has no comments

- **Severity:** Medium
- **Location:** `src/plugin/create-parsers.ts:27-52`
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
