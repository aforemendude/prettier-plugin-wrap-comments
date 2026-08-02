# Code Review: Plugin Integration

## Findings

### 5. Every normally parsed nonempty file is parsed twice even when it has no comments

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
