import type { ParserOptions } from "prettier";

export type AstWithComments = {
  comments?: unknown;
  program?: {
    comments?: unknown;
  };
};

export type RawComment = {
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

export type CommentRange = {
  end: number;
  kind: "block" | "line";
  start: number;
};

export type Replacement = {
  end: number;
  start: number;
  text: string;
};

export type WrapOptions = Pick<
  ParserOptions,
  "endOfLine" | "printWidth" | "tabWidth" | "useTabs"
>;
