# Code Review: Package Infrastructure

## Findings

### README overstates how trailing-comment indentation is preserved

- **Severity:** Low
- **References:** `README.md:55-56`, validated against `src/comments/wrap-trailing-line-comment.ts:83-103`
- **Problem:** The README says an overlong trailing line comment is moved above the code and wrapped using the code
  line's indentation. For a line composed of closing delimiters, the implementation deliberately adds one indentation
  level instead of using that line's indentation.
- **Impact:** Users configuring or evaluating the plugin can receive output at a different indentation level than the
  documented general rule, especially for comments trailing `}`, `]`, or `)` lines.
- **Recommendation:** Qualify the behavior description with the closing-delimiter exception and explain that those
  comments are indented one level so they remain visually inside the construct being closed.

## Unresolved questions

- `package.json:39` declares the open-ended peer range `prettier >=3.0.0`, while the lockfile validates development only
  against Prettier 3.9.6. Confirm whether compatibility with every future Prettier major is an intentional contract;
  otherwise cap the range before the next breaking major and widen it only after compatibility validation.
