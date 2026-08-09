# Changelog

---

## v1.1.1 (August 8, 2026)

### Performance Improvements

- Avoid redundant parsing for comment-free files
- Match comments to AST ranges in a single pass

### Bug Fixes

- Standalone leading block comment wrapping and placement
- Parenthesized trailing comments in JSX and template expressions
- Prettier ignore handling for trailing comments, block markers, and JSX-form markers
- Flow type comments, Flow directives, and Node test coverage controls
- ECMAScript whitespace and JavaScript line terminators
- Multiline JSX comment layout and native ESTree printer hooks
- Markdown thematic rule stability across repeated formatting

---

## v1.1.0 (August 2, 2026)

### Added Features

- Printer-aware comment wrapping
- Offset-sensitive formatting
- Embedded expression trailing comments
- Unicode display width and line separators

### Bug Fixes

- JSX comment layout and ordering
- Prettier ignore handling
- Zero tab width formatting

---

## v1.0.6 (June 6, 2026)

### Added Features

- Wrap leading inline comments

### Bug Fixes

- JSX/TSX expression closing braces
- Prettier ignore handling

---

## v1.0.5 (June 5, 2026)

### Bug Fixes

- Hashbang metadata
- Block-form Prettier ignore comments

---

## v1.0.4 (June 5, 2026)

### Added Features

- JSX/TSX expression comments support
- Support for Prettier ignore comments

### Bug Fixes

- Trailing comment replacements
- Overlap detection fix

---

## v1.0.3 (June 4, 2026)

### Added Features

- Preserved bang-comments

### Bug Fixes

- Directive comment detection
- Text replacements safety

---

## v1.0.2 (June 4, 2026)

- Initial release
