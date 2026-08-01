import type { WrapOptions } from '../../../src/shared/types.js';

const defaultOptions: WrapOptions = {
  endOfLine: 'lf',
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
};

export function getWrapOptions(overrides: Partial<WrapOptions>): WrapOptions {
  return { ...defaultOptions, ...overrides };
}
