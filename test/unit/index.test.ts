import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const parsers = { babel: { marker: 'parser' } };
  const printers = { estree: { marker: 'printer' } };

  return {
    createParsers: vi.fn(() => parsers),
    createPrinters: vi.fn(() => printers),
    parsers,
    printers,
  };
});

vi.mock('../../src/plugin/create-parsers.js', () => ({
  createParsers: mocks.createParsers,
}));

vi.mock('../../src/plugin/create-printers.js', () => ({
  createPrinters: mocks.createPrinters,
}));

import plugin, { parsers, printers } from '../../src/index.js';

describe('plugin entry point', () => {
  it('exports the initialized parsers and printers by name and as one plugin', () => {
    expect(mocks.createParsers).toHaveBeenCalledTimes(1);
    expect(mocks.createPrinters).toHaveBeenCalledTimes(1);
    expect(parsers).toBe(mocks.parsers);
    expect(printers).toBe(mocks.printers);
    expect(plugin).toStrictEqual({ parsers: mocks.parsers, printers: mocks.printers });
  });
});
