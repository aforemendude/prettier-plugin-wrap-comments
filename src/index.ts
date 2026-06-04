import type { Plugin } from "prettier";
import * as estreePlugin from "prettier/plugins/estree";

import { buildParsers } from "./parsers.js";

const parsers = buildParsers();
const printers = estreePlugin.printers;
const plugin: Plugin = {
  parsers,
  printers,
};

export { parsers, printers };
export default plugin;
