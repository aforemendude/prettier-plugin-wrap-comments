# Code Review: Plugin Integration

## Scope and review basis

Reviewed `src/index.ts` and `src/plugin/**` as the plugin-integration segment of the repository-wide review. Directly
related production contracts in `src/comments/**` and `src/utils/**` are consulted only when needed to verify behavior.
Generated output, third-party dependency source, individual test cases and assertions, fixtures, and formatting are out
of scope.

The review was organized around parser registration and preprocessing, native-printer layout probing, JSX rewrite
metadata and printer integration, and the package entry-point contract. Relevant package exports and TypeScript build
settings were inspected to verify the entry-point contract. Findings were reported only after verification against the
current source and, where useful, focused execution against the current committed build.

## Findings

### 1. Comment-free files pay for an avoidable second full parse

- **Severity:** Medium
- **Reference:** `src/plugin/create-parsers.ts:50-60` (the relevant eligible-comment syntax is confirmed by
  `src/comments/comment-ranges.ts:68-75`)
- **Problem:** After the underlying parser's preprocessing finishes, the wrapper always builds a complete AST at line 53
  and only then discovers that the AST has no comments at line 58. Prettier subsequently parses the returned
  preprocessed text again for its real formatting pass. Consequently, every normally formatted comment-free file handled
  by `babel`, `babel-ts`, or `typescript` incurs an extra full parse even though this plugin has nothing to do.
- **Impact:** The plugin imposes CPU and allocation overhead across comment-free source files, which can be substantial
  in large files and repository-wide formatting runs. A focused local benchmark on a generated 10,000-statement
  comment-free Babel file measured median end-to-end formatting time of 689 ms with the plugin versus 589 ms without it
  (eight warmed samples each); the exact ratio is environment-dependent, but the redundant parse is deterministic from
  the call flow.
- **Recommendation:** Before `parser.parse`, return `preprocessed` when it contains neither `//` nor `/*`. This is a
  safe cheap fast path for the plugin's current behavior: every comment it can classify and rewrite must begin with one
  of those exact delimiters. Delimiters inside strings or regular expressions merely cause a conservative false positive
  and retain the current parse path; the check cannot skip an eligible comment. Keep the AST-based check for texts that
  contain either delimiter.

### 2. Files containing only deliberately skipped comments still trigger a full recursive formatting pass

- **Severity:** Medium
- **Reference:** `src/plugin/create-parsers.ts:58-63`; the later eligibility decisions are deferred to
  `src/comments/wrap-comments.ts:74-80` and `src/comments/wrap-comments.ts:128-129`
- **Problem:** The parser wrapper decides whether to run the native-layout probe solely from
  `collectAstComments(ast).length`. Thus a file containing only JSDoc, bang-preserved, triple-slash, directive, or
  otherwise ineligible comments still enters `getPrinterLayoutSource`, which recursively formats the entire file, and
  only afterward reaches the eligibility checks that guarantee no rewrite. This work includes an additional parse/print
  and, whenever native formatting changes the text, another explicit parse of the formatted result.
- **Impact:** Common source dominated by JSDoc or directives incurs the pipeline's most expensive analysis despite
  producing exactly the same plugin result. A focused local benchmark on a generated 3,000-declaration Babel file
  containing only JSDoc measured median end-to-end formatting time of 1,672 ms with the plugin versus 463 ms without it
  (six warmed samples each). Exact timing is environment-dependent, but the unnecessary recursive format follows
  deterministically from the current control flow.
- **Recommendation:** After the initial AST parse and before `getPrinterLayoutSource`, classify comment entries with the
  existing block/line eligibility predicates and return `preprocessed` when every comment is categorically skipped. Keep
  the complete wrapping pipeline for any potentially eligible comment so contextual decisions such as `prettier-ignore`,
  placement, and movement retain their current behavior.

### 3. The native-layout probe and final printer disagree after an ignore marker is neutralized

- **Severity:** Medium
- **Reference:** `src/plugin/get-printer-layout-source.ts:15-28`; `src/plugin/create-parsers.ts:33-35` and
  `src/plugin/create-parsers.ts:62-63`
- **Problem:** Layout probing formats with the unwrapped native parser, so an exact `prettier-ignore` marker above an
  eligible standalone line-comment group retains Prettier's native ignore effect during the probe. The real parse later
  calls `neutralizePrettierIgnoreForIgnoredComments`, intentionally removing that effect so the following code formats
  normally. Trailing-comment movement nevertheless trusts the stale probed line width. At `printWidth: 50`, the current
  build formats the following source to a 52-column final code line while leaving the trailing comment inline:

  ```js
  // prettier-ignore
  // kept
  const result={alpha:1,beta:2}; // w w w w w w
  ```

  The probe sees the preserved 45-column raw code line and classifies it as fitting; after neutralization, native
  spacing expands the line to `const result = { alpha: 1, beta: 2 }; // w w w w w w`. The inverse is also reproducible:
  excessive raw spacing makes the probe move a short trailing comment even though the neutralized final line would fit.

- **Impact:** Output can exceed the configured `printWidth`, or a trailing comment can be moved unnecessarily,
  specifically in a supported `prettier-ignore` workflow whose purpose is to preserve the ignored comment group while
  allowing the subsequent code to format. This contradicts the plugin's final-layout-based trailing-comment behavior and
  can produce avoidable source churn.
- **Recommendation:** Make the parser used by the layout-only plugin apply the same ignore-neutralization step to its
  freshly parsed AST before printing, without sharing or mutating the outer AST or metadata. Alternatively, invalidate
  probed layouts for comments whose preceding control flow includes a marker that the final parse will neutralize, so
  those comments use a conservative source-layout fallback rather than known-inconsistent measurements.

### 4. Speculative Babel parsing corrupts the real parser selection for Flow files

- **Severity:** High
- **Reference:** `src/plugin/create-parsers.ts:31-35` and `src/plugin/create-parsers.ts:50-54`; the same shared-options
  risk recurs at `src/plugin/get-printer-layout-source.ts:34`
- **Problem:** The wrapper's preprocessing analysis calls the native Babel parser with Prettier's live `ParserOptions`
  object. When the Babel parser detects an `@flow` pragma, it mutates `options.parser` from `babel` to `babel-flow` as
  part of its native delegation behavior. That mutation escapes the speculative parse. The later real wrapper parse
  still calls the parser object captured for `babel`, but now with `options.parser === 'babel-flow'`; the native parser
  no longer takes its auto-delegation branch and instead rejects Flow-only syntax. The explicit formatted-output reparse
  in `getPrinterLayoutSource` also receives the shared outer options and would reintroduce this bug whenever native
  formatting changes the text, even if the first analysis parse were isolated.
- **Impact:** Valid Flow source formatted through the advertised `babel` parser fails completely. With the current
  build, native Prettier successfully formats both `// @flow\nconst value: number = 1;` and
  `/* @flow */\nconst value: number = 1;`, while adding this plugin throws `Unexpected token (2:12)` for each. This
  breaks a major established Babel-parser workflow rather than merely changing comment layout.
- **Recommendation:** Give every analysis-only call to `parser.parse` its own shallow-cloned options object whose
  `parser` is reset to the wrapper's `parserName`; do this both in `createWrappedParser.preprocess` and for the explicit
  reparse in `getPrinterLayoutSource`. Do not suppress or roll back the mutation made during the later real parse: that
  invocation should start with `parserName` and retain the native parser's normal option-mutation/delegation semantics
  for the rest of Prettier's actual formatting pass.

### 5. CR-only multiline JSX comments bypass the printer override

- **Severity:** Medium
- **Reference:** `src/plugin/create-printers.ts:47-54`
- **Problem:** The custom JSX container layout recognizes a rewritten block comment as multiline only when its AST value
  contains `\n`. With `endOfLine: 'cr'`, the wrapper deliberately rebuilds comments with `\r` separators, Babel and
  TypeScript preserve those separators in the comment value, and the rewrite metadata is present, but this predicate
  returns false. The native empty-expression printer then handles a shape for which the custom override was introduced.
- **Impact:** All three supported parsers produce collapsed, misindented JSX comment output for a supported Prettier
  end-of-line setting. A focused current-build reproduction at `printWidth: 40` yields the equivalent of
  `    {/*\r * ...\r */}`: the opening brace and comment delimiter share a line, body stars start at column 1, and the
  closing delimiter and brace share a line. The same source with LF or CRLF receives the intended expanded and indented
  brace/comment layout.
- **Recommendation:** Treat `\r` as a line break as well as `\n` when identifying rewritten multiline comments. Prefer a
  predicate covering all ECMAScript line terminators (`\r`, `\n`, U+2028, and U+2029) so printer selection matches the
  source-line utilities' definition of a multiline value.

### 6. The plugin unnecessarily overrides unrelated `estree-json` printers

- **Severity:** Low
- **Reference:** `src/plugin/create-printers.ts:16-18`
- **Problem:** `createPrinters` spreads every native Estree printer into the exported plugin even though the wrapper
  only registers JavaScript/TypeScript parsers with the `estree` AST format and customizes only the `estree` printer.
  This also claims `estree-json` globally. Under Prettier's normal last-plugin precedence, loading this plugin after a
  separate `estree-json` printer silently replaces that printer with the copied native implementation despite
  wrap-comments having no JSON parser or JSON behavior.
- **Impact:** Otherwise independent plugins cannot reliably customize the `json-stringify` parser alongside
  wrap-comments; their output depends on plugin order, and placing wrap-comments last disables the JSON customization
  for no functional reason. A focused reproduction using a marker `estree-json` printer produced the marker when loaded
  alone or after wrap-comments, but native JSON output and zero custom-printer calls when the marker plugin was loaded
  immediately before wrap-comments.
- **Recommendation:** Export only the overridden `estree` printer from `createPrinters` instead of spreading
  `estreePlugin.printers`. This preserves the required JavaScript/TypeScript delegation while leaving `estree-json`
  ownership to Prettier or a plugin that intentionally customizes it.

## Unresolved questions

None.

## Reviewed areas without verified findings

No verified findings were identified in the `src/index.ts` default/named export wiring, the supported parser-name
registry, or the normal LF/CRLF JSX rewrite-metadata handoff and printer delegation. This statement records the result
of the bounded review and focused checks; it does not imply those areas are defect-free.

## Checks and areas not covered

- Confirmed the worktree was clean before creating this report with `git status --short`.
- Traced parser registration, preprocessing, and the comment-range classification contract in current source.
- Benchmarked the verified comment-free parser path with eight warmed samples per configuration on a generated
  10,000-statement Babel source file; this was a focused performance observation, not a general benchmark of all inputs
  or environments.
- Benchmarked the verified all-JSDoc path with six warmed samples per configuration on a generated 3,000-declaration
  Babel source file; this likewise establishes local impact rather than a portable performance target.
- Reproduced both directions of the ignore-neutralization/layout mismatch with the current committed build: final
  normalized expansion can leave a 52-56 column trailing-comment line at `printWidth: 50`, while normalized contraction
  can cause an unnecessary move.
- Reproduced Babel parser-option mutation by observing `options.parser` change from `babel` before wrapped preprocessing
  to `babel-flow` afterward, followed by the actual parse receiving `babel-flow`; verified the two valid line/block
  pragma examples succeed natively and fail with the plugin.
- Reproduced the CR-only JSX printer failure with `babel`, `babel-ts`, and `typescript`, and compared each against its
  correctly expanded LF and CRLF output.
- Reproduced `estree-json` printer displacement with Prettier's `json-stringify` parser: a competing printer was called
  when loaded alone or after wrap-comments, but was not called when loaded immediately before wrap-comments.
- Ran `./node_modules/.bin/vitest run test/unit/plugin test/unit/index.test.ts`: 5 files and 35 tests passed.
- Ran `npm run test:integration`: 2 files and 54 tests passed. The fixtures and individual assertions were not reviewed.
- Ran `npm run typecheck`: passed.
- Did not edit or inspect generated output as reviewable source, inspect third-party dependency source, install
  alternate dependency versions, review individual test cases/fixtures, or run portable/multi-environment performance
  benchmarks. Runtime reproductions used the repository's installed Prettier 3.9.6 on Node.js 24.18.0.
