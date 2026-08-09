import { format } from 'prettier';

import { isBlankLine, normalizeLineTerminators } from './source-lines.js';
import { getTabWidth } from './wrap-options.js';
import type { WrapOptions } from './wrap-options.js';

const MAX_MARKDOWN_FORMAT_PASSES = 3;

export async function formatMarkdownLines(
  markdown: string,
  printWidth: number,
  options: WrapOptions,
): Promise<string[]> {
  const normalized = trimBlankEdges(normalizeLineTerminators(markdown));
  let formatted: string;

  try {
    formatted = await formatMarkdown(normalized, printWidth, options);
  } catch {
    return normalized.split('\n');
  }

  // Prettier canonicalizes thematic rules to `---`, which can expose a front-matter parse on the next pass.
  if (startsWithThematicRule(normalized)) {
    formatted = await stabilizePotentialFrontMatter(formatted, printWidth, options);
  }

  return formatted.replace(/\n$/, '').split('\n');
}

async function formatMarkdown(markdown: string, printWidth: number, options: WrapOptions): Promise<string> {
  return format(markdown, {
    endOfLine: 'lf',
    parser: 'markdown',
    printWidth,
    proseWrap: 'always',
    tabWidth: getTabWidth(options),
    useTabs: options.useTabs,
  });
}

async function stabilizePotentialFrontMatter(
  formatted: string,
  printWidth: number,
  options: WrapOptions,
): Promise<string> {
  const seen = new Set([formatted]);
  let current = formatted;

  for (let pass = 1; pass < MAX_MARKDOWN_FORMAT_PASSES && hasPotentialFrontMatterAmbiguity(current); pass += 1) {
    let next: string;

    try {
      next = await formatMarkdown(current, printWidth, options);
    } catch {
      return current;
    }

    if (next === current || seen.has(next)) {
      return current;
    }

    seen.add(next);
    current = next;
  }

  return current;
}

function startsWithThematicRule(markdown: string): boolean {
  const [firstLine = ''] = markdown.split('\n', 1);

  return /^[ \t]{0,3}([*_-])(?:[ \t]*\1){2,}[ \t]*$/u.test(firstLine);
}

function hasPotentialFrontMatterAmbiguity(markdown: string): boolean {
  const lines = markdown.replace(/\n$/u, '').split('\n');

  if (lines[0] !== '---') {
    return false;
  }

  const closingDelimiterIndex = lines.indexOf('---', 1);

  return closingDelimiterIndex > 1 && (isBlankLine(lines[1]) || isBlankLine(lines[closingDelimiterIndex - 1]));
}

function trimBlankEdges(markdown: string): string {
  const lines = markdown.split('\n');

  while (isBlankLine(lines[0])) {
    lines.shift();
  }

  while (isBlankLine(lines.at(-1))) {
    lines.pop();
  }

  return lines.join('\n');
}
