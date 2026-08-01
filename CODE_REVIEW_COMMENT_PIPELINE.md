# Code Review: Comment Transformation Pipeline

## Findings

### Unicode JavaScript line separators can make wrapping delete later statements

- **Severity:** Medium
- **Location:** `src/utils/source-lines.ts:21-39`, `src/comments/comment-location.ts:8-32`,
  `src/utils/display-width.ts:5-6`, and `src/comments/wrap-trailing-line-comment.ts:26-60`
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
- **Location:** `src/comments/wrap-comments.ts:96-105` and `src/comments/wrap-trailing-line-comment.ts:26-60`
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
