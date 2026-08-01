const PRAGMA_DIRECTIVE_COMMENT_PATTERNS: readonly RegExp[] = [
  /^@(?:license|preserve)\b/u,
  /^@(?:jsxFrag|jsxImportSource|jsxRuntime|jsx)\b/u,
  /^@(?:ts-check|ts-expect-error|ts-ignore|ts-nocheck)\b/u,
  /^[@#]__(?:NO_SIDE_EFFECTS|PURE)__\b/u,
];

const SOURCE_MAP_DIRECTIVE_COMMENT_PATTERNS: readonly RegExp[] = [
  /^[#@][ \t]*sourceMappingURL=/u,
  /^[#@][ \t]*sourceURL=/u,
  /^sourceMappingURL=/u,
  /^sourceURL=/u,
];

const TOOL_DIRECTIVE_COMMENT_PATTERNS: readonly RegExp[] = [
  /^biome-ignore\b/u,
  /^c8\b/u,
  /^deno-lint-ignore\b/u,
  /^eslint\b/u,
  /^eslint-/u,
  /^exported\b/u,
  /^globals?\b/u,
  /^istanbul\b/u,
  /^jshint\b/u,
  /^nyc\b/u,
  /^oxlint\b/u,
  /^prettier-ignore\b/u,
  /^prettier-ignore-start\b/u,
  /^prettier-ignore-end\b/u,
  /^stylelint\b/u,
  /^tslint\b/u,
  /^v8\b/u,
  /^vite-ignore\b/u,
];

const BUNDLER_DIRECTIVE_COMMENT_PATTERNS: readonly RegExp[] = [
  /^webpack(?:ChunkName|Exclude|Ignore|Include|Mode|Prefetch|Preload)\b/u,
];

const DIRECTIVE_COMMENT_PATTERNS: readonly RegExp[] = [
  ...PRAGMA_DIRECTIVE_COMMENT_PATTERNS,
  ...SOURCE_MAP_DIRECTIVE_COMMENT_PATTERNS,
  ...TOOL_DIRECTIVE_COMMENT_PATTERNS,
  ...BUNDLER_DIRECTIVE_COMMENT_PATTERNS,
];

export function isDirectiveComment(body: string): boolean {
  const normalizedBody = body.trimStart();

  return DIRECTIVE_COMMENT_PATTERNS.some((pattern) => pattern.test(normalizedBody));
}

export function isPrettierIgnoreComment(body: string): boolean {
  return body.trim() === 'prettier-ignore';
}
