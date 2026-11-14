import { PACKAGE_MANAGERS } from './launchGuard';
import { pathsOfPatch } from './patchPaths';

const HEADER = 'diff --git ';
const MANIFESTS: ReadonlyArray<string> = PACKAGE_MANAGERS.flatMap((manager) => manager.manifests);
const LOCKFILES: ReadonlyArray<string> = PACKAGE_MANAGERS.flatMap((manager) => manager.lockfiles);
const STRUCTURE_CHARS = '{}[](),';
const QUOTE_CHARS = '"\'`';
const NAME_STOP_CHARS = ' \t"\'`=<>~!:;,[]{}()@';
const VERSION_CHARS = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.+-_';
const VERSION_PREFIX_CHARS = '^~v=<> ';
const DIGITS = '0123456789';

type Grant = Readonly<{ name: string; version: string | null }>;

type Entry = Grant & Readonly<{ line: string }>;

type ParsedLine = Readonly<{ kind: 'structure' }> | Readonly<{ kind: 'entry'; entry: Entry }>;

type TextParams = { readonly text: string };

const baseNameOf = ({ text }: TextParams): string => text.slice(text.lastIndexOf('/') + 1);

const entryVersionOf = ({ text }: TextParams): string | null => {
  const start = [...text].findIndex((char) => DIGITS.includes(char));
  if (start === -1) {
    return null;
  }
  let end = start;
  while (end < text.length && VERSION_CHARS.includes(text.charAt(end))) {
    end += 1;
  }
  return text.slice(start, end);
};

const normalVersionOf = ({ text }: TextParams): string => {
  let start = 0;
  while (start < text.length && VERSION_PREFIX_CHARS.includes(text.charAt(start))) {
    start += 1;
  }
  return text.slice(start);
};

const parsedLineOf = ({ text }: TextParams): ParsedLine | null => {
  const trimmed = text.trim();
  const body = trimmed.startsWith('require ') ? trimmed.slice('require '.length).trim() : trimmed;
  if ([...body].every((char) => STRUCTURE_CHARS.includes(char))) {
    return { kind: 'structure' };
  }
  if (body.startsWith('[') && body.endsWith(']')) {
    return { kind: 'structure' };
  }
  let start = 0;
  while (start < body.length && QUOTE_CHARS.includes(body.charAt(start))) {
    start += 1;
  }
  let end = body.charAt(start) === '@' ? start + 1 : start;
  while (end < body.length && !NAME_STOP_CHARS.includes(body.charAt(end))) {
    end += 1;
  }
  const name = body.slice(start, end);
  if (name === '') {
    return null;
  }
  const rest = body.slice(end);
  const version = entryVersionOf({ text: rest });
  const tail = rest.trim();
  if (version === null && (tail.endsWith('{') || tail.endsWith('['))) {
    return { kind: 'structure' };
  }
  const line = body.endsWith(',') ? body.slice(0, -1) : body;
  return { kind: 'entry', entry: { name: name.toLowerCase(), version, line } };
};

type AllowedParams = { readonly allowedPackages: ReadonlyArray<string> };

const allowedEntriesOf = ({ allowedPackages }: AllowedParams): ReadonlyArray<Grant> =>
  allowedPackages.map((subject) => {
    const at = subject.lastIndexOf('@');
    if (at <= 0) {
      return { name: subject.toLowerCase(), version: null };
    }
    return {
      name: subject.slice(0, at).toLowerCase(),
      version: normalVersionOf({ text: subject.slice(at + 1) }),
    };
  });

type SectionsParams = { readonly patch: string };

const sectionsOf = ({ patch }: SectionsParams): ReadonlyMap<string, ReadonlyArray<string>> => {
  const sections = new Map<string, ReadonlyArray<string>>();
  const chunks = patch
    .split(`\n${HEADER}`)
    .map((chunk, index) => (index === 0 ? chunk : `${HEADER}${chunk}`));
  for (const chunk of chunks) {
    const lines = chunk.split('\n');
    for (const path of pathsOfPatch({ patch: chunk })) {
      sections.set(path, lines);
    }
  }
  return sections;
};

type ChangedParams = { readonly lines: ReadonlyArray<string> };

type ManifestVerdict = Readonly<{ isCovered: boolean; hasAllowedChange: boolean }>;

type CoverParams = ChangedParams & { readonly allowed: ReadonlyArray<Grant> };

type ListParams = { readonly entry: Entry; readonly list: ReadonlyArray<Entry> };

const isListed = ({ entry, list }: ListParams): boolean =>
  list.some((other) => other.line === entry.line);

type GrantParams = {
  readonly entry: Entry;
  readonly isAdded: boolean;
  readonly allowed: ReadonlyArray<Grant>;
};

const isGranted = ({ entry, isAdded, allowed }: GrantParams): boolean =>
  allowed.some(
    (grant) =>
      grant.name === entry.name &&
      (!isAdded ||
        grant.version === null ||
        (entry.version !== null && normalVersionOf({ text: entry.version }) === grant.version)),
  );

const manifestVerdictOf = ({ lines, allowed }: CoverParams): ManifestVerdict => {
  const changed = lines.filter(
    (line) =>
      (line.startsWith('+') || line.startsWith('-')) &&
      !line.startsWith('+++') &&
      !line.startsWith('---'),
  );
  const added: Entry[] = [];
  const removed: Entry[] = [];
  for (const line of changed) {
    const parsed = parsedLineOf({ text: line.slice(1) });
    if (parsed === null) {
      return { isCovered: false, hasAllowedChange: false };
    }
    if (parsed.kind === 'structure') {
      continue;
    }
    (line.startsWith('+') ? added : removed).push(parsed.entry);
  }
  const left = [
    ...added
      .filter((entry) => !isListed({ entry, list: removed }))
      .map((entry) => ({ entry, isAdded: true })),
    ...removed
      .filter((entry) => !isListed({ entry, list: added }))
      .map((entry) => ({ entry, isAdded: false })),
  ];
  const isCovered = left.every(({ entry, isAdded }) => isGranted({ entry, isAdded, allowed }));
  return { isCovered, hasAllowedChange: left.length > 0 };
};

type Params = {
  readonly paths: ReadonlyArray<string>;
  readonly patch: string | null;
  readonly allowedPackages: ReadonlyArray<string>;
};

export const unattributedDependencyPathsOf = ({
  paths,
  patch,
  allowedPackages,
}: Params): ReadonlyArray<string> => {
  const manifests = paths.filter((path) => MANIFESTS.includes(baseNameOf({ text: path })));
  const lockfiles = paths.filter((path) => LOCKFILES.includes(baseNameOf({ text: path })));
  if (patch === null || allowedPackages.length === 0) {
    return [...manifests, ...lockfiles];
  }
  const sections = sectionsOf({ patch });
  const allowed = allowedEntriesOf({ allowedPackages });
  const verdicts = manifests.map((path) => {
    const lines = sections.get(path);
    const verdict =
      lines === undefined
        ? { isCovered: false, hasAllowedChange: false }
        : manifestVerdictOf({ lines, allowed });
    return { path, ...verdict };
  });
  const isLockAttributed =
    verdicts.length > 0 &&
    verdicts.every((verdict) => verdict.isCovered) &&
    verdicts.some((verdict) => verdict.hasAllowedChange);
  return [
    ...verdicts.filter((verdict) => !verdict.isCovered).map((verdict) => verdict.path),
    ...lockfiles.filter((path) => !isLockAttributed || !sections.has(path)),
  ];
};
