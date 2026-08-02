import type { AstPath, Doc, ParserOptions, Plugin, Printer } from 'prettier';
import { doc } from 'prettier';
import * as estreePlugin from 'prettier/plugins/estree';

import { isRecord } from '../utils/type-guards.js';
import { isRewrittenJsxBlockComment } from './jsx-comment-rewrite-metadata.js';

const { hardline, indent } = doc.builders;

type AstNode = Record<string, unknown>;
type PrintFunction = Parameters<Printer<AstNode>['print']>[2];

export function createPrinters(): NonNullable<Plugin['printers']> {
  const estreePrinter = estreePlugin.printers.estree as Printer<AstNode>;

  return {
    ...estreePlugin.printers,
    estree: {
      ...estreePrinter,
      print(path: AstPath<AstNode>, options: ParserOptions<AstNode>, print: PrintFunction, args?: unknown): Doc {
        if (isRewrittenMultilineEmptyJsxExpressionBlockComment(path.node)) {
          return ['{', indent([hardline, print('expression')]), hardline, '}'];
        }

        return estreePrinter.print(path, options, print, args);
      },
    },
  };
}

function isRewrittenMultilineEmptyJsxExpressionBlockComment(node: unknown): boolean {
  if (!isRecord(node) || node['type'] !== 'JSXExpressionContainer') {
    return false;
  }

  const expression = node['expression'];

  if (!isRecord(expression) || expression['type'] !== 'JSXEmptyExpression') {
    return false;
  }

  const comments = expression['comments'];

  return Array.isArray(comments) && comments.some(isRewrittenMultilineBlockComment);
}

function isRewrittenMultilineBlockComment(comment: unknown): boolean {
  if (!isRecord(comment) || (comment['type'] !== 'Block' && comment['type'] !== 'CommentBlock')) {
    return false;
  }

  const value = comment['value'];

  return typeof value === 'string' && value.includes('\n') && isRewrittenJsxBlockComment(comment);
}
