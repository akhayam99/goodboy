type Params = {
  readonly path: string;
  readonly word: string;
  readonly text: string;
};

type Grammar = {
  readonly keywords: ReadonlySet<string>;
  readonly modifiers: ReadonlySet<string>;
};

const ECMA: Grammar = {
  keywords: new Set(['const', 'let', 'var', 'function', 'class', 'interface', 'type', 'enum']),
  modifiers: new Set(['export', 'default', 'declare', 'async', 'abstract']),
};

const RUST: Grammar = {
  keywords: new Set(['fn', 'struct', 'enum', 'trait', 'type', 'const', 'static', 'mod']),
  modifiers: new Set(['pub', 'async', 'unsafe', 'const', 'extern']),
};

const PYTHON: Grammar = {
  keywords: new Set(['def', 'class']),
  modifiers: new Set(['async']),
};

const GO: Grammar = {
  keywords: new Set(['func', 'type', 'var', 'const']),
  modifiers: new Set([]),
};

const GRAMMAR_BY_EXTENSION: Readonly<Record<string, Grammar>> = {
  ts: ECMA,
  tsx: ECMA,
  mts: ECMA,
  cts: ECMA,
  js: ECMA,
  jsx: ECMA,
  mjs: ECMA,
  cjs: ECMA,
  rs: RUST,
  py: PYTHON,
  go: GO,
};

const IDENTIFIER_START = /^[A-Za-z_$][A-Za-z0-9_$]*/;

const extensionOf = (path: string): string => {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
};

type ModifierParams = { readonly grammar: Grammar; readonly token: string };

const isModifier = ({ grammar, token }: ModifierParams): boolean =>
  grammar.modifiers.has(token) || token.startsWith('pub(');

export const isDefinition = ({ path, word, text }: Params): boolean => {
  const grammar = GRAMMAR_BY_EXTENSION[extensionOf(path)];
  if (grammar === undefined) {
    return false;
  }
  const tokens = text.trim().split(/\s+/);
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const token = (tokens[index] ?? '').replace(/\*$/, '');
    if (grammar.keywords.has(token)) {
      const next = tokens[index + 1] ?? '';
      if (IDENTIFIER_START.exec(next)?.[0] === word) {
        return true;
      }
    }
    if (!isModifier({ grammar, token })) {
      return false;
    }
  }
  return false;
};
