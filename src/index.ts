import { format, type Parser, type ParserOptions, type Plugin } from "prettier";
import * as babelPlugin from "prettier/plugins/babel";
import * as estreePlugin from "prettier/plugins/estree";
import * as typescriptPlugin from "prettier/plugins/typescript";

type AstWithComments = {
  comments?: unknown;
  program?: {
    comments?: unknown;
  };
};

type RawComment = {
  end?: unknown;
  loc?: {
    start?: {
      column?: unknown;
    };
  };
  range?: unknown;
  start?: unknown;
  type?: unknown;
  value?: unknown;
};

type CommentRange = {
  end: number;
  kind: "block" | "line";
  start: number;
};

type Replacement = {
  end: number;
  start: number;
  text: string;
};

type WrapOptions = Pick<
  ParserOptions,
  "endOfLine" | "printWidth" | "tabWidth" | "useTabs"
>;

const DEFAULT_PRINT_WIDTH = 80;
const DEFAULT_TAB_WIDTH = 2;

const parserNames = ["babel", "babel-ts", "typescript"] as const;

function wrapParser<T>(parser: Parser<T>): Parser<T> {
  return {
    ...parser,
    async preprocess(text, options) {
      const preprocessed =
        parser.preprocess === undefined
          ? text
          : await parser.preprocess(text, options);

      let ast: T;

      try {
        ast = await parser.parse(preprocessed, options);
      } catch {
        return preprocessed;
      }

      return wrapComments(preprocessed, ast, options);
    },
  };
}

function buildParsers(): Plugin["parsers"] {
  const parsers: Plugin["parsers"] = {};

  for (const parserName of parserNames) {
    const sourceParsers =
      parserName === "typescript"
        ? typescriptPlugin.parsers
        : babelPlugin.parsers;
    const parser = (
      sourceParsers as Record<string, Parser<unknown> | undefined>
    )[parserName];

    if (parser !== undefined) {
      parsers[parserName] = wrapParser(parser);
    }
  }

  return parsers;
}

async function wrapComments<T>(
  text: string,
  ast: T,
  options: WrapOptions,
): Promise<string> {
  const comments = collectComments(ast)
    .map((comment) => toCommentRange(comment, text))
    .filter((comment): comment is CommentRange => comment !== undefined)
    .sort((left, right) => left.start - right.start);

  if (comments.length === 0) {
    return text;
  }

  const replacements: Replacement[] = [];
  const tabWidth = getTabWidth(options);

  for (let index = 0; index < comments.length; index += 1) {
    const comment = comments[index];

    if (comment.kind === "block") {
      const replacement = await wrapBlockComment(text, comment, options);

      if (replacement !== undefined) {
        replacements.push(replacement);
      }

      continue;
    }

    if (
      !isStandaloneLineComment(text, comment) ||
      shouldSkipLineComment(text, comment)
    ) {
      continue;
    }

    const group = [comment];

    while (index + 1 < comments.length) {
      const nextComment = comments[index + 1];

      if (
        nextComment.kind !== "line" ||
        !isStandaloneLineComment(text, nextComment) ||
        shouldSkipLineComment(text, nextComment) ||
        !areAdjacentLineComments(text, group[group.length - 1], nextComment) ||
        getColumnAt(text, comment.start, tabWidth) !==
          getColumnAt(text, nextComment.start, tabWidth)
      ) {
        break;
      }

      group.push(nextComment);
      index += 1;
    }

    const replacement = await wrapLineCommentGroup(text, group, options);

    if (replacement !== undefined) {
      replacements.push(replacement);
    }
  }

  return applyReplacements(text, replacements);
}

function collectComments(ast: unknown): RawComment[] {
  const candidate = ast as AstWithComments;

  if (Array.isArray(candidate.comments)) {
    return candidate.comments as RawComment[];
  }

  if (Array.isArray(candidate.program?.comments)) {
    return candidate.program.comments as RawComment[];
  }

  return [];
}

function toCommentRange(
  comment: RawComment,
  text: string,
): CommentRange | undefined {
  const range = Array.isArray(comment.range) ? comment.range : undefined;
  const start =
    numberOrUndefined(comment.start) ?? numberOrUndefined(range?.[0]);
  const end = numberOrUndefined(comment.end) ?? numberOrUndefined(range?.[1]);

  if (start === undefined || end === undefined || start >= end) {
    return undefined;
  }

  const rawStart = text.slice(start, start + 3);

  if (rawStart.startsWith("//")) {
    return { end, kind: "line", start };
  }

  if (rawStart.startsWith("/*")) {
    return { end, kind: "block", start };
  }

  if (typeof comment.type === "string") {
    if (comment.type.includes("Line")) {
      return { end, kind: "line", start };
    }

    if (comment.type.includes("Block")) {
      return { end, kind: "block", start };
    }
  }

  return undefined;
}

async function wrapLineCommentGroup(
  text: string,
  comments: CommentRange[],
  options: WrapOptions,
): Promise<Replacement | undefined> {
  const bodyLines = comments.map((comment) =>
    normalizeLineCommentBody(text.slice(comment.start + 2, comment.end)),
  );

  if (bodyLines.every((line) => line.trim() === "")) {
    return undefined;
  }

  const tabWidth = getTabWidth(options);
  const markerColumn = getColumnAt(text, comments[0].start, tabWidth);
  const availableWidth = getAvailableContentWidth(options, markerColumn + 3);
  const formattedLines = await formatMarkdownLines(
    bodyLines.join("\n"),
    availableWidth,
    options,
  );
  const newline = getPreferredNewline(text, options);
  const continuationIndent = getContinuationIndent(
    text,
    comments[0].start,
    markerColumn,
    options,
  );
  const replacementText = formattedLines
    .map((line, index) => {
      const commentText = line.length === 0 ? "//" : `// ${line}`;

      return index === 0
        ? commentText
        : `${newline}${continuationIndent}${commentText}`;
    })
    .join("");
  const start = comments[0].start;
  const end = comments[comments.length - 1].end;

  if (replacementText === text.slice(start, end)) {
    return undefined;
  }

  return {
    end,
    start,
    text: replacementText,
  };
}

async function wrapBlockComment(
  text: string,
  comment: CommentRange,
  options: WrapOptions,
): Promise<Replacement | undefined> {
  const raw = text.slice(comment.start, comment.end);

  if (raw.startsWith("/**")) {
    return undefined;
  }

  const markdown = normalizeBlockCommentBody(raw);

  if (markdown.trim() === "" || isDirectiveComment(markdown)) {
    return undefined;
  }

  const tabWidth = getTabWidth(options);
  const markerColumn = getColumnAt(text, comment.start, tabWidth);
  const availableWidth = getAvailableContentWidth(options, markerColumn + 3);
  const formattedLines = await formatMarkdownLines(
    markdown,
    availableWidth,
    options,
  );
  const replacementText = buildBlockReplacement(
    text,
    comment,
    formattedLines,
    options,
  );

  if (
    replacementText === undefined ||
    replacementText === text.slice(comment.start, comment.end)
  ) {
    return undefined;
  }

  return {
    end: comment.end,
    start: comment.start,
    text: replacementText,
  };
}

function buildBlockReplacement(
  text: string,
  comment: CommentRange,
  formattedLines: string[],
  options: WrapOptions,
): string | undefined {
  const tabWidth = getTabWidth(options);
  const markerColumn = getColumnAt(text, comment.start, tabWidth);
  const singleLine = `/* ${formattedLines.join(" ")} */`;
  const singleLineWidth = getColumns(singleLine, tabWidth);

  if (
    formattedLines.length === 1 &&
    markerColumn + singleLineWidth <= getPrintWidth(options)
  ) {
    return singleLine;
  }

  if (!isStandaloneBlockComment(text, comment)) {
    return undefined;
  }

  const newline = getPreferredNewline(text, options);
  const indent = getLinePrefix(text, comment.start);
  const body = formattedLines
    .map((line) => `${indent} *${line.length === 0 ? "" : ` ${line}`}`)
    .join(newline);

  return `/*${newline}${body}${newline}${indent} */`;
}

async function formatMarkdownLines(
  markdown: string,
  printWidth: number,
  options: WrapOptions,
): Promise<string[]> {
  const normalized = trimBlankEdges(markdown.replace(/\r\n?/g, "\n"));

  try {
    const formatted = await format(normalized, {
      endOfLine: "lf",
      parser: "markdown",
      printWidth,
      proseWrap: "always",
      tabWidth: getTabWidth(options),
      useTabs: options.useTabs,
    });

    return formatted.replace(/\n$/, "").split("\n");
  } catch {
    return normalized.split("\n");
  }
}

function normalizeLineCommentBody(rawBody: string): string {
  if (rawBody.trim() === "") {
    return "";
  }

  return rawBody.replace(/^[ \t]?/, "").replace(/[ \t]+$/u, "");
}

function normalizeBlockCommentBody(rawComment: string): string {
  const body = rawComment.slice(2, -2).replace(/\r\n?/g, "\n");
  const lines = body.split("\n");

  if (lines.length === 1) {
    return lines[0].trim();
  }

  while (lines.length > 0 && lines[0].trim() === "") {
    lines.shift();
  }

  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }

  return lines
    .map((line) => {
      const withoutIndent = line.replace(/^[ \t]*/u, "");

      if (!withoutIndent.startsWith("*")) {
        return withoutIndent.replace(/[ \t]+$/u, "");
      }

      return withoutIndent
        .slice(1)
        .replace(/^[ \t]?/u, "")
        .replace(/[ \t]+$/u, "");
    })
    .join("\n");
}

function shouldSkipLineComment(text: string, comment: CommentRange): boolean {
  const raw = text.slice(comment.start, comment.end);

  if (raw.startsWith("///")) {
    return true;
  }

  return isDirectiveComment(normalizeLineCommentBody(raw.slice(2)));
}

function isDirectiveComment(body: string): boolean {
  return /^(?:@(?:__NO_SIDE_EFFECTS__|__PURE__|jsx|jsxImportSource|license|preserve|ts-check|ts-expect-error|ts-ignore|ts-nocheck)\b|#\s*sourceMappingURL=|[@#]__PURE__\b|biome-ignore\b|c8\b|deno-lint-ignore\b|eslint\b|eslint-|exported\b|globals?\b|istanbul\b|jshint\b|nyc\b|oxlint\b|prettier-ignore\b|prettier-ignore-start\b|prettier-ignore-end\b|sourceMappingURL=|stylelint\b|tslint\b|v8\b|vite-ignore\b|webpack(?:ChunkName|Exclude|Ignore|Include|Mode|Prefetch|Preload)\b)/u.test(
    body.trimStart(),
  );
}

function isStandaloneLineComment(text: string, comment: CommentRange): boolean {
  return /^[ \t]*$/u.test(getLinePrefix(text, comment.start));
}

function areAdjacentLineComments(
  text: string,
  previous: CommentRange,
  next: CommentRange,
): boolean {
  return /^(?:\r\n|\n|\r)[ \t]*$/u.test(text.slice(previous.end, next.start));
}

function applyReplacements(text: string, replacements: Replacement[]): string {
  let result = text;

  for (const replacement of [...replacements].sort(
    (left, right) => right.start - left.start,
  )) {
    result =
      result.slice(0, replacement.start) +
      replacement.text +
      result.slice(replacement.end);
  }

  return result;
}

function getAvailableContentWidth(
  options: WrapOptions,
  contentStartColumn: number,
): number {
  return Math.max(1, getPrintWidth(options) - contentStartColumn);
}

function getPrintWidth(options: WrapOptions): number {
  return typeof options.printWidth === "number"
    ? options.printWidth
    : DEFAULT_PRINT_WIDTH;
}

function getTabWidth(options: WrapOptions): number {
  return typeof options.tabWidth === "number"
    ? options.tabWidth
    : DEFAULT_TAB_WIDTH;
}

function getPreferredNewline(text: string, options: WrapOptions): string {
  if (options.endOfLine === "crlf") {
    return "\r\n";
  }

  if (options.endOfLine === "cr") {
    return "\r";
  }

  if (options.endOfLine === "auto") {
    const match = /\r\n|\n|\r/u.exec(text);

    return match?.[0] ?? "\n";
  }

  return "\n";
}

function getContinuationIndent(
  text: string,
  commentStart: number,
  markerColumn: number,
  options: WrapOptions,
): string {
  const linePrefix = getLinePrefix(text, commentStart);

  if (/^[ \t]*$/u.test(linePrefix)) {
    return linePrefix;
  }

  return makeIndent(markerColumn, options);
}

function getLinePrefix(text: string, index: number): string {
  return text.slice(getLineStart(text, index), index);
}

function getLineStart(text: string, index: number): number {
  const newlineIndex = text.lastIndexOf("\n", index - 1);

  return newlineIndex === -1 ? 0 : newlineIndex + 1;
}

function getLineEnd(text: string, index: number): number {
  const newlineIndex = text.indexOf("\n", index);

  if (newlineIndex === -1) {
    return text.length;
  }

  return text[newlineIndex - 1] === "\r" ? newlineIndex - 1 : newlineIndex;
}

function getColumnAt(text: string, index: number, tabWidth: number): number {
  return getColumns(text.slice(getLineStart(text, index), index), tabWidth);
}

function getColumns(text: string, tabWidth: number): number {
  let column = 0;

  for (const character of text) {
    if (character === "\t") {
      column += tabWidth - (column % tabWidth);
    } else {
      column += 1;
    }
  }

  return column;
}

function makeIndent(column: number, options: WrapOptions): string {
  const tabWidth = getTabWidth(options);

  if (options.useTabs === true) {
    const tabs = Math.floor(column / tabWidth);
    const spaces = column % tabWidth;

    return `${"\t".repeat(tabs)}${" ".repeat(spaces)}`;
  }

  return " ".repeat(column);
}

function isStandaloneBlockComment(
  text: string,
  comment: CommentRange,
): boolean {
  const before = text.slice(getLineStart(text, comment.start), comment.start);
  const after = text.slice(comment.end, getLineEnd(text, comment.end));

  return /^[ \t]*$/u.test(before) && /^[ \t]*$/u.test(after);
}

function trimBlankEdges(markdown: string): string {
  const lines = markdown.split("\n");

  while (lines.length > 0 && lines[0].trim() === "") {
    lines.shift();
  }

  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }

  return lines.join("\n");
}

function numberOrUndefined(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

const parsers = buildParsers();
const printers = estreePlugin.printers;
const plugin: Plugin = {
  parsers,
  printers,
};

export { parsers, printers };
export default plugin;
