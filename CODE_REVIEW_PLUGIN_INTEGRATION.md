# Code Review: Plugin Integration

## Findings

### 4. Named parser and printer exports are incorrectly typed as optional

- **Severity:** Low
- **Location:** `src/index.ts:6-13`; `src/plugin/create-parsers.ts:12-24`; `src/plugin/create-printers.ts:12-28`
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
