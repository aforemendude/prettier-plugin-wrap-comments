export const SUPPORTED_PARSER_NAMES = ['babel', 'babel-ts', 'typescript'] as const;

export type SupportedParserName = (typeof SUPPORTED_PARSER_NAMES)[number];
