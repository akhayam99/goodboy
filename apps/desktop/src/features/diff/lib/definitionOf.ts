import { definitionOfScope } from './definitionOfScope';

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
  keywords: new Set(['const', 'function', 'class', 'interface', 'type', 'enum']),
  modifiers: new Set([
    'export',
    'default',
    'declare',
    'async',
    'abstract',
    'public',
    'private',
    'protected',
    'static',
    'override',
    'get',
    'set',
  ]),
};

const RUST: Grammar = {
  keywords: new Set(['fn', 'struct', 'enum', 'trait', 'type', 'const', 'static']),
  modifiers: new Set(['pub', 'async', 'unsafe', 'const', 'extern']),
};

const PYTHON: Grammar = {
  keywords: new Set(['def', 'class']),
  modifiers: new Set(['async']),
};

const GO: Grammar = {
  keywords: new Set(['func', 'type', 'const']),
  modifiers: new Set([]),
};

const GRAMMAR_BY_EXTENSION = new Map<string, Grammar>([
  ['ts', ECMA],
  ['tsx', ECMA],
  ['mts', ECMA],
  ['cts', ECMA],
  ['js', ECMA],
  ['jsx', ECMA],
  ['mjs', ECMA],
  ['cjs', ECMA],
  ['rs', RUST],
  ['py', PYTHON],
  ['go', GO],
]);

const IDENTIFIER_START = /^[A-Za-z_$][A-Za-z0-9_$]*/;

type ExtensionParams = { readonly path: string };

const extensionOf = ({ path }: ExtensionParams): string => {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1).toLowerCase();
};

type ModifierParams = { readonly grammar: Grammar; readonly token: string };

const isModifier = ({ grammar, token }: ModifierParams): boolean =>
  grammar.modifiers.has(token) || token.startsWith('pub(');

export const definitionOf = ({ path, word, text }: Params): string | null => {
  if (definitionOfScope({ path }) === 'dependency') {
    return null;
  }
  const grammar = GRAMMAR_BY_EXTENSION.get(extensionOf({ path }));
  if (grammar === undefined) {
    return null;
  }
  const tokens = text.trim().split(/\s+/);
  for (let index = 0; index < tokens.length; index += 1) {
    const token = (tokens[index] ?? '').replace(/\*$/, '');
    if (grammar.keywords.has(token)) {
      const next = tokens[index + 1] ?? '';
      if (IDENTIFIER_START.exec(next)?.[0] === word) {
        return token === 'fn' || token === 'def' || token === 'func' ? 'function' : token;
      }
      if (grammar === GO && token === 'func' && next.startsWith('(')) {
        const declaration = tokens.slice(index + 1).join(' ');
        const end = declaration.indexOf(')');
        if (end >= 0 && IDENTIFIER_START.exec(declaration.slice(end + 1).trim())?.[0] === word) {
          return 'method';
        }
      }
      if (!isModifier({ grammar, token })) {
        return null;
      }
      continue;
    }
    if (grammar === ECMA && IDENTIFIER_START.exec(token)?.[0] === word) {
      const signature = tokens.slice(index).join(' ').slice(word.length).trimStart();
      const close = signature.indexOf(')');
      const body = signature.indexOf('{', close + 1);
      if (
        signature.startsWith('(') &&
        close >= 0 &&
        body > close &&
        !signature.slice(0, body).includes(';') &&
        !signature.slice(0, body).includes('=>')
      ) {
        return 'method';
      }
    }
    if (!isModifier({ grammar, token })) {
      return null;
    }
  }
  return null;
};
