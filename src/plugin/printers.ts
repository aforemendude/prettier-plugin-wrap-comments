import type { AstPath, Doc, ParserOptions, Plugin, Printer } from 'prettier';
import { doc } from 'prettier';
import * as estreePlugin from 'prettier/plugins/estree';

const { hardline, indent } = doc.builders;

type AstNode = Record<string, unknown>;
type PrintFunction = (path: AstPath<unknown>) => Doc;

export function buildPrinters(): Plugin['printers'] {
  const estreePrinter = estreePlugin.printers.estree as Printer<AstNode>;

  return {
    ...estreePlugin.printers,
    estree: {
      ...estreePrinter,
      print(path: AstPath<AstNode>, options: ParserOptions<AstNode>, print: PrintFunction, args?: unknown): Doc {
        if (isMultilineEmptyJsxExpressionBlockComment(path.node)) {
          return ['{', indent([hardline, path.call(print, 'expression')]), hardline, '}'];
        }

        return estreePrinter.print(path, options, print, args);
      },
    },
  };
}

function isMultilineEmptyJsxExpressionBlockComment(node: unknown): boolean {
  if (!isRecord(node) || node['type'] !== 'JSXExpressionContainer') {
    return false;
  }

  const expression = node['expression'];

  if (!isRecord(expression) || expression['type'] !== 'JSXEmptyExpression') {
    return false;
  }

  const comments = expression['comments'];

  return Array.isArray(comments) && comments.some(isMultilineBlockComment);
}

function isMultilineBlockComment(comment: unknown): boolean {
  if (!isRecord(comment) || (comment['type'] !== 'Block' && comment['type'] !== 'CommentBlock')) {
    return false;
  }

  const value = comment['value'];

  return typeof value === 'string' && value.includes('\n');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
