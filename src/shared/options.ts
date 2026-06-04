import type { WrapOptions } from './types.js';

const DEFAULT_PRINT_WIDTH = 80;
const DEFAULT_TAB_WIDTH = 2;

export function getAvailableContentWidth(options: WrapOptions, contentStartColumn: number): number {
  return Math.max(1, getPrintWidth(options) - contentStartColumn);
}

export function getPrintWidth(options: WrapOptions): number {
  return typeof options.printWidth === 'number' ? options.printWidth : DEFAULT_PRINT_WIDTH;
}

export function getTabWidth(options: WrapOptions): number {
  return typeof options.tabWidth === 'number' ? options.tabWidth : DEFAULT_TAB_WIDTH;
}
