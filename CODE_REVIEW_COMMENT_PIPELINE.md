# Code Review: Comment Transformation Pipeline

## Scope and review basis

Reviewed `src/comments/core.ts`, `src/comments/line.ts`, `src/comments/block.ts`, `src/comments/wrap.ts`, and the
directly related helpers `src/shared/markdown.ts`, `src/shared/text.ts`, and `src/shared/types.ts`. Call sites, options,
package metadata, documentation, and focused runtime behavior were consulted only where needed to validate this segment.
Generated `dist/`, third-party source, formatting, individual test cases and fixtures, test assertions, and coverage
adequacy were out of scope.

The review began from a clean worktree. Review basis includes static data-flow and boundary analysis of comment
collection, classification, normalization, Markdown formatting, placement, and replacement application, plus focused
read-only checks using the repository's existing dependencies.

## Findings

### Wrapping multiple JSX expression comments can reverse their order

- **Severity:** Medium
- **Location:** `src/comments/wrap.ts:382-410` and `src/comments/block.ts:97-109`
- **Problem:** JSX layout classification treats any non-whitespace text before a comment as expression content,
  including an earlier comment in the same expression container. In a comment-only container with multiple block
  comments, the last comment is therefore classified as trailing and its multiline replacement is inserted at the start
  of the container's “expression,” ahead of all earlier comments.
- **Impact:** Formatting changes the order of comment content. For example, an end-to-end Babel/JSX check of
  `{/* First ... */ /* Second ... */}` at a width that wraps both comments emitted the complete `Second` block before
  the complete `First` block. This is a user-visible correctness regression for ordered explanations, annotations, or
  examples even though the JavaScript runtime semantics are unchanged.
- **Recommendation:** Classify JSX placement using non-comment expression tokens (or the expression node) rather than
  raw trimmed container slices. When multiple comments occupy a container, build a coordinated replacement that keeps
  their original relative order; at minimum, do not move a “trailing” comment ahead of a prefix made only of comments.

### Unicode display widths are mismeasured when deciding whether comments fit

- **Severity:** Medium
- **Location:** `src/shared/text.ts:92-101`
- **Problem:** `getColumns` assigns one column to every non-tab Unicode code point. Prettier's width model treats wide
  characters such as CJK ideographs and many emoji as two columns and combining sequences as a single displayed column.
  The helper feeds trailing-line fit checks, block-comment fit checks, marker columns, and JSX layout calculations, so
  those decisions diverge systematically from the formatter's own `printWidth` model.
- **Impact:** The plugin leaves lines over `printWidth` unchanged when code before a trailing comment contains wide
  characters, and it moves comments unnecessarily when the prefix contains combining marks. At `printWidth: 25`, an
  end-to-end check left `const x = "漢漢漢"; // note` on one 27-column output line, while it moved `// note` above
  `const x = "ééé";` even though the original line occupies only 24 display columns according to the installed Prettier
  width utility. This affects ordinary localized strings and identifiers, not only malformed Unicode.
- **Recommendation:** Base non-tab segment measurement on Prettier's public string-width utility (or an equivalent
  Unicode-width implementation) and preserve the current tab-stop calculation around those segments. Use the same width
  primitive for every `printWidth` and column decision.

### `prettier-ignore` is neutralized for non-standalone block comments

- **Severity:** Medium
- **Location:** `src/comments/wrap.ts:148-163` and `src/comments/wrap.ts:479-491`
- **Problem:** `isPrettierIgnoredBlockComment` verifies that the marker is standalone and adjacent, but never verifies
  that the following block comment is standalone. `neutralizePrettierIgnoreForIgnoredComments` then rewrites the marker
  in the parsed AST whenever that block comment is otherwise eligible for wrapping. Consequently, a leading block
  comment that shares its line with code is mistaken for the ignore target even though the documented special handling
  applies only when the marker is directly above a standalone block comment.
- **Impact:** The plugin defeats the user's explicit Prettier ignore request and reformats the following node. In an
  end-to-end comparison, vanilla Prettier preserved `// prettier-ignore\n/* explanatory comment */ const x={a:1,b:2};`,
  while the plugin expanded the object literal and normalized its spacing. The block comment itself remained unchanged,
  making the lost ignore behavior non-obvious.
- **Recommendation:** Require `isStandaloneBlockComment(text, comment)` before treating a block comment as the marker's
  special target or neutralizing the marker. For a non-standalone leading block comment, retain normal Prettier ignore
  semantics for the following AST node.

### Measuring pre-format source columns breaks formatter idempotence

- **Severity:** Medium
- **Location:** `src/comments/line.ts:34-45`, `src/comments/block.ts:47-50`, `src/comments/block.ts:79-86`, and
  `src/comments/wrap.ts:384-404`
- **Problem:** Wrapping decisions are made during preprocessing from comment columns in the unformatted source, before
  Prettier's JavaScript printer corrects surrounding indentation and line layout. A comment that fits at its input
  column can therefore exceed `printWidth` after the printer moves it, while a comment that appears too wide in the
  input can be expanded even though its final position has room. JSX attempts to estimate an output `contentColumn`, but
  `buildBlockReplacement` still tests the complete single-line block against the original source `markerColumn`,
  creating the same inconsistency internally.
- **Impact:** Output can change again on a second formatting pass, violating a central formatter invariant. At
  `printWidth: 40`, an unindented standalone comment inside an unformatted `if` block was indented onto a 41-column line
  on the first pass and wrapped only on the second. A JSX variant emitted a 42-column single-line comment on the first
  pass and expanded it on the second. The opposite JSX layout expanded
  `const x = <span>{/* This comment should fit. */}</span>;` even though its intact final line would occupy only 36
  columns.
- **Recommendation:** Make all width decisions against the comment's predicted printer-output column, not its raw input
  column. That may require formatting or deriving the surrounding layout before comment reflow; for explicit JSX
  layouts, carry one output marker/content column and use it consistently in both Markdown wrapping and complete-block
  fit checks. Verify first-pass idempotence across ordinary indentation changes as well as leading, trailing, and
  comment-only JSX layouts.

### Unicode JavaScript line separators can make wrapping delete later statements

- **Severity:** Medium
- **Location:** `src/shared/text.ts:68-85` and `src/comments/line.ts:70-105`
- **Problem:** The shared line-boundary helpers recognize only LF (with a CRLF adjustment), but JavaScript also treats
  U+2028 LINE SEPARATOR and U+2029 PARAGRAPH SEPARATOR as line terminators. Unlike CR and CRLF, Prettier does not
  normalize these characters before the plugin's preprocessing. A standalone line comment after either separator is
  therefore seen as part of the preceding physical line, and `getLineEnd` can extend its trailing-comment removal range
  to end of file.
- **Impact:** Formatting can silently delete valid source while still returning parseable output. In public-path Babel
  checks using both U+2028 and U+2029, an input containing `const before = 1;`, an overlong standalone comment, and
  `const after = 2;` lost the entire `const after` statement; vanilla Prettier preserved all three lines and normalized
  the separators to LF.
- **Recommendation:** Implement JavaScript-aware line-start and line-end scanning that recognizes LF, CRLF, CR, U+2028,
  and U+2029, and use it consistently in adjacency, standalone classification, width measurement, and replacement
  construction. Add a guard ensuring a trailing-comment removal never extends past the comment's actual JavaScript line.

### Moving embedded trailing line comments can turn them into program data

- **Severity:** Medium
- **Location:** `src/comments/wrap.ts:99-108` and `src/comments/line.ts:61-106`
- **Problem:** Any non-standalone line comment is sent through the generic trailing-line mover, which inserts the
  wrapped comment at the physical source line start without considering lexical containers crossed by that move. Inside
  a `JSXExpressionContainer`, the insertion can land before the opening `{`; inside a template interpolation on a later
  template line, it can land in raw template text before `${`. The inserted `//` lines are no longer JavaScript comments
  when the rewritten source is parsed.
- **Impact:** Formatting changes runtime data. In a public Babel/JSX check of
  `{value // this is a deliberately very long trailing comment inside a JSX expression\n}`, Babel reparsed the moved
  lines as `JSXText`, and Prettier emitted visible child text containing the `//` markers and comment words. A
  template-literal check similarly moved three `//` lines into the raw string before `${value}`, changing the resulting
  string value. Vanilla Prettier kept both inputs' text as JavaScript comments inside their expression delimiters.
- **Recommendation:** Determine whether the physical line prefix crosses a JSX-expression, template-interpolation, or
  other lexical boundary before moving a trailing comment. Never insert outside the JavaScript expression that
  originally owns the comment; either leave such comments trailing or relocate them to a safe position inside the
  containing expression with a guaranteed line break before its value.

### Formatting every comment as a separate Markdown document scales poorly

- **Severity:** Medium
- **Location:** `src/comments/wrap.ts:57-143`, `src/comments/line.ts:34-37`, `src/comments/block.ts:47-50`, and
  `src/shared/markdown.ts:14-24`
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

## Unresolved questions

None.

## Checks and areas not covered

- `./node_modules/.bin/tsc -p tsconfig.json --outDir <temporary-directory>` completed with no diagnostics; output was
  kept outside the repository so generated workspace artifacts were not changed.
- A direct helper-pipeline check initially exposed incorrect CR-only line boundaries, but an end-to-end
  `prettier.format` check with the compiled plugin confirmed that Prettier normalizes input before plugin preprocessing
  and preserves all source. The helper-only behavior is therefore not reported as a package finding.
- An end-to-end `prettier.format` check with the Babel parser verified that two wrapped block comments in a comment-only
  JSX expression container are emitted in reverse order.
- End-to-end Babel formatting at `printWidth: 25`, cross-checked with the installed `prettier.util.getStringWidth`,
  verified both undercounting for CJK text and overcounting for combining sequences.
- An end-to-end comparison with vanilla Prettier verified that a marker above a block comment sharing its line with code
  is neutralized and the ignored declaration is reformatted.
- End-to-end checks verified first-pass idempotence failures for both an ordinary standalone line comment in initially
  unindented code and a comment-only JSX expression; a third JSX check verified unnecessary expansion in the opposite
  source/output-column direction.
- Public-path Babel checks with each of U+2028 and U+2029 verified deletion of the statement following an overlong
  standalone line comment; the equivalent vanilla Prettier checks preserved it.
- End-to-end Babel checks verified that moving trailing line comments outside JSX and template expression boundaries
  reparses their text as rendered JSX content and raw template-string data, respectively.
- A five-run warmed benchmark at 200 and 500 separated short comments measured public formatter totals and isolated
  `formatMarkdownLines` loops, confirming linear per-comment Markdown-format cost. Timings are local and are included
  only as magnitude evidence, not universal performance guarantees.
- The repository's build-based test suite was not run because it regenerates `dist/`, while this review permitted no
  workspace writes beyond this report. Focused public-path checks used source compiled into a temporary directory
  instead.
- Individual test cases, fixtures, assertions, and coverage adequacy were not reviewed by scope. Generated output and
  third-party source were also not reviewed.
- Runtime reproductions used the Babel parser. The shared transformation paths were reviewed statically for `babel-ts`
  and `typescript`, but the reproductions were not repeated under those parsers.
