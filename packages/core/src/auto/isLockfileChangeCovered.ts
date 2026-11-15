import { isNameGranted, isSpecGranted, type DependencyGrant } from './dependencyGrant';
import { patchLinesOf, type PatchLine } from './patchLinesOf';

const STRUCTURE_CHARS = '{}[](), ';
const DEPENDENCY_KEYS: ReadonlyArray<string> = [
  'dependencies',
  'optionalDependencies',
  'peerDependencies',
];
const TOML_LOCKS: ReadonlyArray<string> = ['Cargo.lock', 'uv.lock'];
const QUOTES = '"\'';
const MODULES = 'node_modules/';

type Named = Readonly<{ name: string; version: string | null }>;

type TextParams = {
  readonly text: string;
};

const isStructure = ({ text }: TextParams): boolean =>
  [...text.trim()].every((char) => STRUCTURE_CHARS.includes(char));

const unquotedOf = ({ text }: TextParams): string => {
  const trimmed = text.trim();
  const bare = trimmed.endsWith(',') ? trimmed.slice(0, -1).trim() : trimmed;
  const first = bare.charAt(0);
  const isQuoted =
    first !== '' && QUOTES.includes(first) && bare.length > 1 && bare.endsWith(first);
  return isQuoted ? bare.slice(1, -1) : bare;
};

const namedOf = ({ text }: TextParams): ReadonlyArray<Named> =>
  unquotedOf({ text })
    .split(', ')
    .map((part) => {
      const unquoted = unquotedOf({ text: part });
      const modules = unquoted.lastIndexOf(MODULES);
      const bare = modules === -1 ? unquoted : unquoted.slice(modules + MODULES.length);
      const at = bare.lastIndexOf('@');
      return at <= 0
        ? { name: bare.toLowerCase(), version: null }
        : { name: bare.slice(0, at).toLowerCase(), version: bare.slice(at + 1) };
    });

const firstNameOf = ({ text }: TextParams): string => namedOf({ text })[0]?.name ?? '';

const isEntryKey = ({ text }: TextParams): boolean => {
  const unquoted = unquotedOf({ text });
  return unquoted.startsWith(MODULES) || unquoted.lastIndexOf('@') > 0;
};

type GrantsParams = {
  readonly grants: ReadonlyArray<DependencyGrant>;
};

type KeyParams = GrantsParams & {
  readonly key: string;
};

const isKeyGranted = ({ grants, key }: KeyParams): boolean =>
  namedOf({ text: key }).every((named) => isNameGranted({ grants, name: named.name }));

type ClosureKeyParams = KeyParams & {
  readonly closure: ReadonlySet<string>;
};

const isKeyOwned = ({ grants, closure, key }: ClosureKeyParams): boolean =>
  isKeyGranted({ grants, key }) ||
  (isEntryKey({ text: key }) && namedOf({ text: key }).every((named) => closure.has(named.name)));

type IndentLine = Readonly<{
  line: PatchLine;
  key: string;
  value: string;
  isHeader: boolean;
  chain: ReadonlyArray<string>;
}>;

type KeyRest = Readonly<{ key: string; rest: string }>;

const keyAndRestOf = ({ text }: TextParams): KeyRest => {
  const trimmed = text.trim();
  const quote = trimmed.charAt(0);
  const end = quote !== '' && QUOTES.includes(quote) ? trimmed.indexOf(quote, 1) : -1;
  if (end !== -1) {
    return { key: trimmed.slice(0, end + 1), rest: trimmed.slice(end + 1).trim() };
  }
  const colon = trimmed.indexOf(': ');
  if (colon !== -1) {
    return { key: trimmed.slice(0, colon), rest: trimmed.slice(colon).trim() };
  }
  return trimmed.endsWith(':')
    ? { key: trimmed.slice(0, -1), rest: ':' }
    : { key: trimmed, rest: '' };
};

type LinesParams = {
  readonly lines: ReadonlyArray<PatchLine>;
};

type Header = Readonly<{ indent: number; key: string }>;

const indentLinesOf = ({ lines }: LinesParams): ReadonlyArray<IndentLine> => {
  const parsed: IndentLine[] = [];
  let stack: ReadonlyArray<Header> = [];
  for (const line of lines) {
    if (line.sign === '@') {
      stack = [];
      continue;
    }
    if (line.text.trim() === '') {
      continue;
    }
    const indent = line.text.length - line.text.trimStart().length;
    stack = stack.filter((header) => header.indent < indent);
    const { key, rest } = keyAndRestOf({ text: line.text });
    const afterColon = rest.startsWith(':') ? rest.slice(1).trim() : rest;
    const value = afterColon.endsWith(',') ? afterColon.slice(0, -1).trim() : afterColon;
    const isHeader = rest.startsWith(':') && (value === '' || value === '{' || value === '[');
    parsed.push({ line, key, value, isHeader, chain: stack.map((header) => header.key) });
    if (isHeader) {
      stack = [...stack, { indent, key }];
    }
  }
  return parsed;
};

type EntriesParams = GrantsParams & {
  readonly entries: ReadonlyArray<IndentLine>;
};

const indentClosureOf = ({ grants, entries }: EntriesParams): ReadonlySet<string> => {
  const closure = new Set<string>();
  let size = -1;
  while (closure.size !== size) {
    size = closure.size;
    for (const entry of entries) {
      const parent = entry.chain.at(-1);
      const isDependencyLeaf =
        !entry.isHeader &&
        parent !== undefined &&
        DEPENDENCY_KEYS.includes(unquotedOf({ text: parent }));
      const isOwned = entry.chain.some((header) => isKeyOwned({ grants, closure, key: header }));
      if (isDependencyLeaf && isOwned) {
        namedOf({ text: entry.key }).forEach((named) => closure.add(named.name));
      }
    }
  }
  return closure;
};

type EntryParams = GrantsParams & {
  readonly closure: ReadonlySet<string>;
  readonly entry: IndentLine;
};

const isHeaderVersionGranted = ({ grants, key }: KeyParams): boolean =>
  namedOf({ text: key }).every(
    (named) =>
      named.version === null || isSpecGranted({ grants, name: named.name, spec: named.version }),
  );

const isIndentLineCovered = ({ grants, closure, entry }: EntryParams): boolean => {
  const { line, key, value, isHeader, chain } = entry;
  if (isStructure({ text: line.text })) {
    return true;
  }
  const headers = isHeader ? [...chain, key] : chain;
  const owner = [...headers]
    .reverse()
    .find((header) => isKeyOwned({ grants, closure, key: header }));
  const isLeafGranted = !isHeader && isKeyGranted({ grants, key });
  const isLeafOwned = !isHeader && isKeyOwned({ grants, closure, key });
  if (owner === undefined && !isLeafOwned) {
    return false;
  }
  if (line.sign !== '+') {
    return true;
  }
  const isVersionedKey = namedOf({ text: key }).some((named) => named.version !== null);
  if ((isHeader || isVersionedKey) && isKeyGranted({ grants, key })) {
    return isHeaderVersionGranted({ grants, key });
  }
  if (isLeafGranted) {
    return isSpecGranted({
      grants,
      name: firstNameOf({ text: key }),
      spec: unquotedOf({ text: value }),
    });
  }
  const isGrantVersion =
    unquotedOf({ text: key }) === 'version' &&
    owner !== undefined &&
    isKeyGranted({ grants, key: owner });
  return isGrantVersion && owner !== undefined
    ? isSpecGranted({
        grants,
        name: firstNameOf({ text: owner }),
        spec: unquotedOf({ text: value }),
      })
    : true;
};

type LockParams = GrantsParams & LinesParams;

const isIndentLockCovered = ({ grants, lines }: LockParams): boolean => {
  const entries = indentLinesOf({ lines });
  const closure = indentClosureOf({ grants, entries });
  return entries
    .filter((entry) => (entry.line.sign === '+' || entry.line.sign === '-') && !entry.line.isMoved)
    .every((entry) => isIndentLineCovered({ grants, closure, entry }));
};

type TomlBlock = Readonly<{
  name: string | null;
  dependencies: ReadonlyArray<string>;
  lines: ReadonlyArray<PatchLine>;
}>;

type FieldParams = {
  readonly text: string;
  readonly field: string;
};

const tomlFieldOf = ({ text, field }: FieldParams): string | null => {
  const trimmed = text.trim();
  const prefix = `${field} = "`;
  return trimmed.startsWith(prefix) && trimmed.endsWith('"')
    ? trimmed.slice(prefix.length, -1)
    : null;
};

const dependencyNameOf = ({ text }: TextParams): string | null => {
  const item = unquotedOf({ text });
  if (item === '' || isStructure({ text: item })) {
    return null;
  }
  const inline = item.indexOf('name = "');
  if (inline !== -1) {
    const start = inline + 'name = "'.length;
    return item.slice(start, item.indexOf('"', start)).toLowerCase();
  }
  return (item.split(' ')[0] ?? '').toLowerCase();
};

const tomlBlocksOf = ({ lines }: LinesParams): ReadonlyArray<TomlBlock> => {
  const groups: PatchLine[][] = [];
  for (const line of lines) {
    const isStart = line.sign === '@' || line.text.trim() === '[[package]]';
    if (isStart || groups.length === 0) {
      groups.push([]);
    }
    if (line.sign !== '@') {
      groups.at(-1)?.push(line);
    }
  }
  return groups.map((group) => {
    const name = group
      .map((line) => tomlFieldOf({ text: line.text, field: 'name' }))
      .find((value) => value !== null);
    const dependencies: string[] = [];
    let isInList = false;
    for (const line of group) {
      const trimmed = line.text.trim();
      if (trimmed.startsWith('dependencies = [')) {
        isInList = !trimmed.endsWith(']');
        continue;
      }
      if (isInList && trimmed === ']') {
        isInList = false;
        continue;
      }
      const dependency = isInList ? dependencyNameOf({ text: trimmed }) : null;
      if (dependency !== null) {
        dependencies.push(dependency);
      }
    }
    return { name: name?.toLowerCase() ?? null, dependencies, lines: group };
  });
};

const isTomlLockCovered = ({ grants, lines }: LockParams): boolean => {
  const blocks = tomlBlocksOf({ lines });
  const closure = new Set(grants.map((grant) => grant.name));
  let size = -1;
  while (closure.size !== size) {
    size = closure.size;
    blocks
      .filter((block) => block.name !== null && closure.has(block.name))
      .forEach((block) => block.dependencies.forEach((name) => closure.add(name)));
  }
  return blocks.every((block) => {
    const changed = block.lines.filter(
      (line) => (line.sign === '+' || line.sign === '-') && !line.isMoved,
    );
    if (changed.length === 0) {
      return true;
    }
    if (block.name === null || !closure.has(block.name)) {
      return false;
    }
    return changed.every((line) => {
      const version = tomlFieldOf({ text: line.text, field: 'version' });
      const name = block.name ?? '';
      return (
        line.sign !== '+' ||
        version === null ||
        !isNameGranted({ grants, name }) ||
        isSpecGranted({ grants, name, spec: version })
      );
    });
  });
};

type GoSumParams = GrantsParams & {
  readonly line: PatchLine;
};

const isGoSumLineCovered = ({ grants, line }: GoSumParams): boolean => {
  const [name = '', version = ''] = line.text.trim().split(' ');
  const pinned = version.endsWith('/go.mod') ? version.slice(0, -'/go.mod'.length) : version;
  return line.sign === '-'
    ? isNameGranted({ grants, name })
    : isSpecGranted({ grants, name, spec: pinned });
};

type Params = GrantsParams & {
  readonly path: string;
  readonly lines: ReadonlyArray<string>;
};

export const isLockfileChangeCovered = ({ path, lines, grants }: Params): boolean => {
  const patchLines = patchLinesOf({ lines });
  const changed = patchLines.filter(
    (line) => (line.sign === '+' || line.sign === '-') && !line.isMoved,
  );
  const base = path.slice(path.lastIndexOf('/') + 1);
  if (changed.length === 0 || base === 'bun.lockb') {
    return false;
  }
  if (base === 'go.sum') {
    return changed.every((line) => isGoSumLineCovered({ grants, line }));
  }
  if (TOML_LOCKS.includes(base)) {
    return isTomlLockCovered({ grants, lines: patchLines });
  }
  return isIndentLockCovered({ grants, lines: patchLines });
};
