import { isNameGranted, isSpecGranted, type DependencyGrant } from './dependencyGrant';
import { patchLinesOf } from './patchLinesOf';

const STRUCTURE_CHARS = '{}[]() ,';
const NAME_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-/@';
const QUOTES = '"\'';
const REQUIREMENT_OPS = '=<>~!';

type ManifestEntry = Readonly<{ name: string; spec: string | null }>;

type ParsedEntry =
  | Readonly<{ kind: 'structure' }>
  | Readonly<{ kind: 'entry'; entry: ManifestEntry }>
  | Readonly<{ kind: 'unknown' }>;

const UNKNOWN: ParsedEntry = { kind: 'unknown' };
const STRUCTURE: ParsedEntry = { kind: 'structure' };

type TextParams = {
  readonly text: string;
};

const isStructure = ({ text }: TextParams): boolean =>
  [...text].every((char) => STRUCTURE_CHARS.includes(char));

const nameLengthOf = ({ text }: TextParams): number => {
  let end = 0;
  while (end < text.length && NAME_CHARS.includes(text.charAt(end))) {
    end += 1;
  }
  return end;
};

type Quoted = Readonly<{ value: string; rest: string }>;

const quotedOf = ({ text }: TextParams): Quoted | null => {
  const quote = text.charAt(0);
  if (!QUOTES.includes(quote) || quote === '') {
    return null;
  }
  const end = text.indexOf(quote, 1);
  if (end === -1) {
    return null;
  }
  return { value: text.slice(1, end), rest: text.slice(end + 1).trim() };
};

const requirementOf = ({ text }: TextParams): ParsedEntry => {
  const nameEnd = nameLengthOf({ text });
  let opEnd = nameEnd;
  while (opEnd < text.length && REQUIREMENT_OPS.includes(text.charAt(opEnd))) {
    opEnd += 1;
  }
  const name = text.slice(0, nameEnd);
  const op = text.slice(nameEnd, opEnd);
  const version = text.slice(opEnd);
  if (name === '' || nameLengthOf({ text: version }) !== version.length) {
    return UNKNOWN;
  }
  return {
    kind: 'entry',
    entry: { name, spec: op === '' && version === '' ? null : `${op}${version}` },
  };
};

type ValueParams = {
  readonly name: string;
  readonly value: string;
};

const valueEntryOf = ({ name, value }: ValueParams): ParsedEntry => {
  if (value === '{' || value === '[') {
    return STRUCTURE;
  }
  const quoted = quotedOf({ text: value });
  if (quoted === null || quoted.rest !== '') {
    return UNKNOWN;
  }
  return { kind: 'entry', entry: { name, spec: quoted.value } };
};

const manifestEntryOf = ({ text }: TextParams): ParsedEntry => {
  const comment = text.indexOf(' //');
  const bare = (comment === -1 ? text : text.slice(0, comment)).trim();
  const unlisted = bare.endsWith(',') ? bare.slice(0, -1).trim() : bare;
  const body = unlisted.startsWith('require ')
    ? unlisted.slice('require '.length).trim()
    : unlisted;
  if (isStructure({ text: body })) {
    return STRUCTURE;
  }
  if (body.startsWith('[') && body.endsWith(']') && !body.includes('"')) {
    return STRUCTURE;
  }
  const quoted = quotedOf({ text: body });
  if (quoted !== null) {
    if (quoted.rest === '') {
      return requirementOf({ text: quoted.value });
    }
    const separator = quoted.rest.charAt(0);
    if (separator !== ':' && separator !== '=') {
      return UNKNOWN;
    }
    return valueEntryOf({ name: quoted.value, value: quoted.rest.slice(1).trim() });
  }
  const nameEnd = nameLengthOf({ text: body });
  const name = body.slice(0, nameEnd);
  const rest = body.slice(nameEnd).trim();
  if (name !== '' && rest.startsWith('=') && !rest.startsWith('==')) {
    return valueEntryOf({ name, value: rest.slice(1).trim() });
  }
  if (name !== '' && rest.startsWith('v') && nameLengthOf({ text: rest }) === rest.length) {
    return { kind: 'entry', entry: { name, spec: rest } };
  }
  return requirementOf({ text: body });
};

type Params = {
  readonly lines: ReadonlyArray<string>;
  readonly grants: ReadonlyArray<DependencyGrant>;
};

export const isManifestChangeCovered = ({ lines, grants }: Params): boolean => {
  const changed = patchLinesOf({ lines }).filter(
    (line) => (line.sign === '+' || line.sign === '-') && !line.isMoved,
  );
  if (changed.length === 0) {
    return false;
  }
  return changed.every((line) => {
    const parsed = manifestEntryOf({ text: line.text });
    if (parsed.kind === 'structure') {
      return true;
    }
    if (parsed.kind === 'unknown') {
      return false;
    }
    const { name, spec } = parsed.entry;
    return line.sign === '-'
      ? isNameGranted({ grants, name })
      : isSpecGranted({ grants, name, spec });
  });
};
