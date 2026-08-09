import type { Plugin } from 'prettier';

import { createParsers } from './plugin/create-parsers.js';
import { createPrinters } from './plugin/create-printers.js';
import { PLUGIN_NAME } from './plugin/plugin-name.js';

const name = PLUGIN_NAME;
const parsers = createParsers();
const printers = createPrinters();
const plugin: NamedPlugin = {
  name,
  parsers,
  printers,
};

export { name, parsers, printers };
export default plugin;

interface NamedPlugin extends Plugin {
  name: string;
}
