import type { Parser, ParserOptions, Plugin } from 'prettier';
import * as babelPlugin from 'prettier/plugins/babel';
import * as typescriptPlugin from 'prettier/plugins/typescript';

import { collectAstComments } from '../comments/comment-ranges.js';
import { neutralizePrettierIgnoreForIgnoredComments } from '../comments/prettier-ignore.js';
import { wrapCommentsWithMetadata } from '../comments/wrap-comments.js';
import { getPrinterLayoutSource } from './get-printer-layout-source.js';
import { markRewrittenJsxBlockComments, setJsxBlockCommentRewrites } from './jsx-comment-rewrite-metadata.js';
import { SUPPORTED_PARSER_NAMES } from './parser-names.js';
import type { SupportedParserName } from './parser-names.js';
import { PLUGIN_NAME } from './plugin-name.js';

export function createParsers(): NonNullable<Plugin['parsers']> {
  const parsers: NonNullable<Plugin['parsers']> = {};

  for (const parserName of SUPPORTED_PARSER_NAMES) {
    const sourceParsers = parserName === 'typescript' ? typescriptPlugin.parsers : babelPlugin.parsers;
    const parser = (sourceParsers as Record<string, Parser<unknown> | undefined>)[parserName];

    if (parser !== undefined) {
      parsers[parserName] = createWrappedParser(parserName, parser);
    }
  }

  return parsers;
}

function createWrappedParser<T>(parserName: SupportedParserName, parser: Parser<T>): Parser<T> {
  const wrappedParser: Parser<T> = {
    ...parser,
    async parse(text, options) {
      const delegate = await resolveParserDelegate(parserName, parser, wrappedParser, options);
      const ast = await parseWithDelegate(text, delegate, options);
      const neutralizedAst = neutralizePrettierIgnoreForIgnoredComments(text, ast);

      markRewrittenJsxBlockComments(text, neutralizedAst, options);

      return neutralizedAst;
    },
    async preprocess(text, options) {
      setJsxBlockCommentRewrites(options, []);

      const delegate = await resolveParserDelegate(parserName, parser, wrappedParser, options);
      const preprocessed = await preprocessWithDelegate(text, delegate, options);

      // Prettier calculates cursor nodes and initial range boundaries after preprocessing, but those offsets still
      // refer to this input. A range-only request will safely re-enter this hook with the extracted source.
      if (hasOffsetSensitiveFormatting(text, options)) {
        return preprocessed;
      }

      if (!preprocessed.includes('//') && !preprocessed.includes('/*')) {
        return preprocessed;
      }

      let ast: T;

      try {
        ast = await parseWithDelegate(preprocessed, delegate, { ...options, parser: parserName });
      } catch {
        return preprocessed;
      }

      if (collectAstComments(ast).length === 0) {
        return preprocessed;
      }

      const printerLayoutSource = await getPrinterLayoutSource(
        preprocessed,
        ast,
        parserName,
        delegate.parser,
        createDelegateOptions(options, delegate.plugins),
      );
      const result = await wrapCommentsWithMetadata(preprocessed, ast, options, printerLayoutSource);

      setJsxBlockCommentRewrites(options, result.jsxBlockCommentRewrites);

      return result.text;
    },
  };

  return wrappedParser;
}

async function resolveParserDelegate<T>(
  parserName: SupportedParserName,
  nativeParser: Parser<T>,
  wrappedParser: Parser<T>,
  options: ParserOptions<T>,
): Promise<ParserDelegate<T>> {
  const plugins = options.plugins ?? [];
  const wrappedPluginIndex = findWrappedPluginIndex(plugins, parserName, wrappedParser);

  if (wrappedPluginIndex === -1) {
    return { parser: nativeParser };
  }

  for (let index = wrappedPluginIndex - 1; index >= 0; index -= 1) {
    const plugin = getPlugin(plugins[index]);
    const parserEntry = getParserEntry(plugin, parserName);

    if (parserEntry === undefined) {
      continue;
    }

    const precedingParser = typeof parserEntry === 'function' ? await parserEntry() : parserEntry;

    if (isParser<T>(precedingParser)) {
      return {
        parser: precedingParser,
        plugins: plugins.slice(0, wrappedPluginIndex),
      };
    }
  }

  return { parser: nativeParser };
}

async function parseWithDelegate<T>(text: string, delegate: ParserDelegate<T>, options: ParserOptions<T>): Promise<T> {
  return withDelegatePlugins(options, delegate.plugins, async () => delegate.parser.parse(text, options));
}

async function preprocessWithDelegate<T>(
  text: string,
  delegate: ParserDelegate<T>,
  options: ParserOptions<T>,
): Promise<string> {
  const preprocess = delegate.parser.preprocess;

  if (preprocess === undefined) {
    return text;
  }

  return withDelegatePlugins(options, delegate.plugins, async () => preprocess(text, options));
}

async function withDelegatePlugins<T, TResult>(
  options: ParserOptions<T>,
  plugins: PluginEntry[] | undefined,
  callback: () => TResult | Promise<TResult>,
): Promise<TResult> {
  if (plugins === undefined) {
    return callback();
  }

  const originalPlugins = options.plugins;

  // A preceding plugin may normalize other options during preprocessing. Keep the same options object while hiding this
  // plugin and anything after it, then restore only the full plugin list once delegation finishes.
  options.plugins = plugins;

  try {
    return await callback();
  } finally {
    options.plugins = originalPlugins;
  }
}

function createDelegateOptions<T>(options: ParserOptions<T>, plugins: PluginEntry[] | undefined): ParserOptions<T> {
  return plugins === undefined ? options : { ...options, plugins };
}

function findWrappedPluginIndex<T>(
  plugins: ParserOptions<T>['plugins'],
  parserName: SupportedParserName,
  wrappedParser: Parser<T>,
): number {
  for (let index = plugins.length - 1; index >= 0; index -= 1) {
    const plugin = getPlugin(plugins[index]);
    const parserEntry = getParserEntry(plugin, parserName);

    if (parserEntry === wrappedParser) {
      return index;
    }
  }

  for (let index = plugins.length - 1; index >= 0; index -= 1) {
    const plugin = getPlugin(plugins[index]);
    const parserEntry = getParserEntry(plugin, parserName);

    if (plugin?.name === PLUGIN_NAME && parserEntry !== undefined) {
      return index;
    }
  }

  return -1;
}

function getPlugin(plugin: PluginEntry | undefined): NamedPlugin | undefined {
  if (typeof plugin !== 'object' || plugin === null || plugin instanceof URL) {
    return undefined;
  }

  return plugin;
}

function getParserEntry(
  plugin: NamedPlugin | undefined,
  parserName: SupportedParserName,
): ParserEntry<unknown> | undefined {
  if (plugin?.parsers === undefined || !Object.hasOwn(plugin.parsers, parserName)) {
    return undefined;
  }

  return plugin.parsers[parserName] as ParserEntry<unknown> | undefined;
}

function isParser<T>(value: unknown): value is Parser<T> {
  return typeof value === 'object' && value !== null && 'parse' in value && typeof value.parse === 'function';
}

function hasOffsetSensitiveFormatting(text: string, options: ParserOptions): boolean {
  const cursorOffset = options['cursorOffset'];
  const hasCursor = typeof cursorOffset === 'number' && cursorOffset >= 0;
  const hasPartialRange = options.rangeStart > 0 || options.rangeEnd < text.length;

  return hasCursor || hasPartialRange;
}

interface NamedPlugin extends Plugin {
  name?: unknown;
}

interface ParserDelegate<T> {
  parser: Parser<T>;
  plugins?: PluginEntry[];
}

type ParserEntry<T> = Parser<T> | (() => Parser<T> | Promise<Parser<T>>);
type PluginEntry = ParserOptions['plugins'][number];
