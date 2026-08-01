import { format } from 'prettier';
import { describe, expect, it, vi } from 'vitest';

import { formatMarkdownLines } from '../../../src/utils/format-markdown.js';
import { createWrapOptions } from '../support/wrap-options.js';

vi.mock('prettier', async (importOriginal) => {
  const actual = await importOriginal<typeof import('prettier')>();

  return { ...actual, format: vi.fn(actual.format) };
});

describe('formatMarkdownLines', () => {
  it('formats Markdown prose into lines at the requested width', async () => {
    await expect(
      formatMarkdownLines('Alpha beta gamma delta epsilon.', 18, createWrapOptions({ printWidth: 18 })),
    ).resolves.toEqual(['Alpha beta gamma', 'delta epsilon.']);
  });

  it('normalizes carriage returns and trims only blank edge lines', async () => {
    const markdown = ['', [' ', 'First paragraph.'].join('\r'), '', 'Second paragraph.', '\t', ''].join('\r\n');

    await expect(formatMarkdownLines(markdown, 80, createWrapOptions({}))).resolves.toEqual([
      'First paragraph.',
      '',
      'Second paragraph.',
    ]);
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
