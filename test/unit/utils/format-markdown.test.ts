import { format } from 'prettier';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { formatMarkdownLines } from '../../../src/utils/format-markdown.js';
import { createWrapOptions } from '../support/wrap-options.js';

vi.mock('prettier', async (importOriginal) => {
  const actual = await importOriginal<typeof import('prettier')>();

  return { ...actual, format: vi.fn(actual.format) };
});

describe('formatMarkdownLines', () => {
  beforeEach(() => {
    vi.mocked(format).mockClear();
  });

  it('formats Markdown prose into lines at the requested width', async () => {
    await expect(
      formatMarkdownLines('Alpha beta gamma delta epsilon.', 18, createWrapOptions({ printWidth: 18 })),
    ).resolves.toEqual(['Alpha beta gamma', 'delta epsilon.']);

    expect(format).toHaveBeenCalledTimes(1);
  });

  it.each(['***', '_ _ _', '- - -'])('stabilizes comments enclosed by %s thematic rules', async (rule) => {
    const markdown = [rule, 'paragraph words', rule].join('\n');

    await expect(formatMarkdownLines(markdown, 80, createWrapOptions({}))).resolves.toEqual([
      '---',
      'paragraph words',
      '---',
    ]);

    expect(format).toHaveBeenCalledTimes(2);
  });

  it('normalizes carriage returns and trims only blank edge lines', async () => {
    const markdown = ['', [' ', 'First paragraph.'].join('\r'), '', 'Second paragraph.', '\t', ''].join('\r\n');

    await expect(formatMarkdownLines(markdown, 80, createWrapOptions({}))).resolves.toEqual([
      'First paragraph.',
      '',
      'Second paragraph.',
    ]);
  });

  it('normalizes JavaScript Unicode line separators', async () => {
    for (const separator of ['\u2028', '\u2029']) {
      const markdown = ['', 'First paragraph.', '', 'Second paragraph.', ''].join(separator);

      await expect(formatMarkdownLines(markdown, 80, createWrapOptions({}))).resolves.toEqual([
        'First paragraph.',
        '',
        'Second paragraph.',
      ]);
    }
  });

  it('returns normalized input lines when Markdown formatting fails', async () => {
    const markdown = ['', 'Alpha beta.', 'Gamma delta.', ''].join('\r');

    vi.mocked(format).mockRejectedValueOnce(new Error('format failed'));

    await expect(formatMarkdownLines(markdown, 80, createWrapOptions({}))).resolves.toEqual([
      'Alpha beta.',
      'Gamma delta.',
    ]);
  });
});
