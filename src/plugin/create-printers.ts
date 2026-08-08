import type { AstPath, Doc, ParserOptions, Plugin, Printer } from 'prettier';
import { doc } from 'prettier';
import * as estreePlugin from 'prettier/plugins/estree';

import { getNeutralizedPrettierIgnoreOriginalText } from '../comments/prettier-ignore.js';
import { normalizeLineTerminators } from '../utils/source-lines.js';
import { isRecord } from '../utils/type-guards.js';
import { isRewrittenJsxBlockComment } from './jsx-comment-rewrite-metadata.js';

const { hardline, indent } = doc.builders;
const { mapDoc, replaceEndOfLine } = doc.utils;

type AstNode = Record<string, unknown>;
type RewrittenMultilineBlockComment = AstNode & { value: string };
type PrintFunction = Parameters<Printer<AstNode>['print']>[2];

export function createPrinters(): NonNullable<Plugin['printers']> {
  const estreePrinter = estreePlugin.printers.estree as Printer<AstNode>;
  const estreePrintComment = estreePrinter.printComment;

  if (estreePrintComment === undefined) {
    throw new Error('Expected the native estree printer to provide printComment');
  }

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
      printComment(path: AstPath<AstNode>, options: ParserOptions<AstNode>): Doc {
        const originalText = getNeutralizedPrettierIgnoreOriginalText(path.node);

        if (originalText !== undefined) {
          const normalizedOriginalText = normalizeLineTerminators(originalText);

          return normalizedOriginalText.includes('\n')
            ? replaceEndOfLine(normalizedOriginalText)
            : normalizedOriginalText;
        }

        if (isRewrittenMultilineBlockComment(path.node)) {
          const printedComment = estreePrintComment(path, options);
          const normalizedComment = mapDoc(printedComment, (currentDoc) =>
            typeof currentDoc === 'string' ? normalizeLineTerminators(currentDoc) : currentDoc,
          );

          return replaceEndOfLine(normalizedComment, hardline);
        }

        return estreePrintComment(path, options);
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

function isRewrittenMultilineBlockComment(comment: unknown): comment is RewrittenMultilineBlockComment {
  if (!isRecord(comment) || (comment['type'] !== 'Block' && comment['type'] !== 'CommentBlock')) {
    return false;
  }

  const value = comment['value'];

  return typeof value === 'string' && /[\r\n\u2028\u2029]/u.test(value) && isRewrittenJsxBlockComment(comment);
}
