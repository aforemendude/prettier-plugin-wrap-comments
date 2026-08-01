import type { WrapOptions } from '../../../src/utils/wrap-options.js';

const defaultOptions: WrapOptions = {
  endOfLine: 'lf',
  printWidth: 80,
  tabWidth: 2,
  useTabs: false,
};

export function createWrapOptions(overrides: Partial<WrapOptions>): WrapOptions {
  return { ...defaultOptions, ...overrides };
}
