// @vitest-environment node
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { describe, expect, it } from 'vitest';

const STORE_DIR = join(__dirname, '..', '..', 'store');
const STORE_FILE = join(STORE_DIR, 'store.ts');
const MAX_REEXPORT_HOPS = 3;

type KeysParams = {
  readonly text: string;
  readonly name: string;
};

type SplitParams = {
  readonly body: string;
};

type ImportParams = {
  readonly text: string;
};

type ResolveParams = {
  readonly file: string;
  readonly name: string;
  readonly hops: number;
};

const bodyAfter = ({ text, start }: { readonly text: string; readonly start: number }): string => {
  let depth = 0;
  let quote: string | null = null;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index] ?? '';
    if (quote !== null) {
      if (char === '\\') {
        index += 1;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
    } else if ('([{'.includes(char)) {
      depth += 1;
    } else if (')]}'.includes(char)) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start + 1, index);
      }
    }
  }
  return '';
};

const splitTopLevel = ({ body }: SplitParams): ReadonlyArray<string> => {
  const parts: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let current = '';
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index] ?? '';
    if (quote !== null) {
      current += char;
      if (char === '\\') {
        index += 1;
        current += body[index] ?? '';
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
    } else if ('([{'.includes(char)) {
      depth += 1;
    } else if (')]}'.includes(char)) {
      depth -= 1;
    } else if (char === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim() !== '') {
    parts.push(current.trim());
  }
  return parts;
};

const keyOf = (entry: string): string | null => {
  const match = /^(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))/.exec(entry);
  return match === null ? null : (match[1] ?? match[2] ?? match[3] ?? null);
};

const keysOfDeclaration = ({ text, name }: KeysParams): ReadonlyArray<string> | null => {
  const objectForm = new RegExp(`export const ${name}\\b[^=]*=\\s*(\\{)`).exec(text);
  const functionForm = new RegExp(
    `export const ${name}\\b[^=]*=\\s*\\(.*?\\)\\s*=>\\s*\\((\\{)`,
  ).exec(text);
  const match = objectForm ?? functionForm;
  if (match === null) {
    return null;
  }
  const start = match.index + match[0].length - 1;
  const body = bodyAfter({ text, start });
  return splitTopLevel({ body })
    .map((entry) => keyOf(entry))
    .filter((key): key is string => key !== null);
};

const importsOf = ({ text }: ImportParams): ReadonlyMap<string, string> => {
  const found = new Map<string, string>();
  for (const match of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*'(\.[^']+)'/g)) {
    for (const part of (match[1] ?? '').split(',')) {
      const name = part.trim().replace(/^type\s+/, '');
      if (name !== '') {
        found.set(name, match[2] ?? '');
      }
    }
  }
  return found;
};

const fileOf = ({ base, specifier }: { readonly base: string; readonly specifier: string }) => {
  const target = join(dirname(base), specifier);
  return [`${target}.ts`, join(target, 'index.ts')].find((candidate) => existsSync(candidate));
};

const resolveKeys = ({ file, name, hops }: ResolveParams): ReadonlyArray<string> | null => {
  if (hops > MAX_REEXPORT_HOPS) {
    return null;
  }
  const text = readFileSync(file, 'utf8');
  const own = keysOfDeclaration({ text, name });
  if (own !== null) {
    return own;
  }
  for (const match of text.matchAll(/export\s*\{([^}]*)\}\s*from\s*'(\.[^']+)'/g)) {
    const names = (match[1] ?? '').split(',').map((part) => part.trim());
    const next = fileOf({ base: file, specifier: match[2] ?? '' });
    if (names.includes(name) && next !== undefined) {
      return resolveKeys({ file: next, name, hops: hops + 1 });
    }
  }
  return null;
};

const initialStateBody = (): string => {
  const text = readFileSync(STORE_FILE, 'utf8');
  const start = text.indexOf('const initialState: AppState');
  const open = text.indexOf('{', text.indexOf('=', start));
  return bodyAfter({ text, start: open });
};

type Source = {
  readonly source: string;
  readonly keys: ReadonlyArray<string>;
};

const collect = (): {
  readonly sources: ReadonlyArray<Source>;
  readonly inline: ReadonlyArray<string>;
  readonly unresolved: ReadonlyArray<string>;
} => {
  const imports = importsOf({ text: readFileSync(STORE_FILE, 'utf8') });
  const entries = splitTopLevel({ body: initialStateBody() });
  const sources: Source[] = [];
  const inline: string[] = [];
  const unresolved: string[] = [];
  for (const entry of entries) {
    const spread = /^\.\.\.\s*([A-Za-z_$][\w$]*)/.exec(entry);
    if (spread === null) {
      inline.push(entry.split(':')[0]?.trim() ?? entry);
      continue;
    }
    const name = spread[1] ?? '';
    const specifier = imports.get(name);
    const file = specifier === undefined ? undefined : fileOf({ base: STORE_FILE, specifier });
    const keys = file === undefined ? null : resolveKeys({ file, name, hops: 0 });
    if (keys === null) {
      unresolved.push(name);
      continue;
    }
    sources.push({ source: name, keys });
  }
  return { sources, inline, unresolved };
};

describe('the keys of the store state', () => {
  it('reads the keys of an object state and of a state built by a function', () => {
    const object = "export const aInitialState: AState = {\n  one: 1,\n  'two': [],\n  three,\n};";
    const made =
      'export const makeState = ({}: Params) => ({\n  one: {},\n  two: { nested: 1 },\n});';
    expect(keysOfDeclaration({ text: object, name: 'aInitialState' })).toEqual([
      'one',
      'two',
      'three',
    ]);
    expect(keysOfDeclaration({ text: made, name: 'makeState' })).toEqual(['one', 'two']);
    expect(keysOfDeclaration({ text: object, name: 'missing' })).toBeNull();
  });

  it('reads every slice state the store spreads, never an empty sweep', () => {
    const { sources, unresolved } = collect();

    expect(unresolved).toEqual([]);
    expect(sources.length).toBeGreaterThan(60);
    expect(sources.every((source) => source.keys.length > 0)).toBe(true);
  });

  it('lets no state key sit in two slices', () => {
    const owners = new Map<string, string[]>();
    for (const { source, keys } of collect().sources) {
      for (const key of keys) {
        owners.set(key, [...(owners.get(key) ?? []), source]);
      }
    }
    const duplicates = [...owners.entries()]
      .filter(([, names]) => names.length > 1)
      .map(([key, names]) => `  - ${key}: ${names.join(', ')}`);

    expect(
      duplicates,
      `a state key belongs to one slice, so the later spread never hides the earlier one ` +
        `(docs/file-system.md, Store slices):\n${duplicates.join('\n')}`,
    ).toEqual([]);
  });

  it('keeps every state key in its slice, none written inline in store.ts', () => {
    expect(collect().inline).toEqual([]);
  });
});
