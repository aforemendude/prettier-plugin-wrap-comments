import type { Plugin } from 'prettier';

import { buildParsers } from './plugin/parsers.js';
import { buildPrinters } from './plugin/printers.js';

const parsers = buildParsers();
const printers = buildPrinters();
const plugin: Plugin = {
  parsers,
  printers,
};

export { parsers, printers };
export default plugin;
