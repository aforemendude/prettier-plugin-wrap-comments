import type { Plugin } from 'prettier';

import { createParsers } from './plugin/create-parsers.js';
import { createPrinters } from './plugin/create-printers.js';

const parsers = createParsers();
const printers = createPrinters();
const plugin: Plugin = {
  parsers,
  printers,
};

export { parsers, printers };
export default plugin;
