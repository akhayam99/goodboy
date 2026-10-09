import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, relative, sep } from 'path';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set([
  'node_modules',
  'dist',
  'target',
  'gen',
  '__tests__',
  'MockScene',
]);

export const IS_UPDATING = process.env.GOODBOY_UPDATE_BASELINE === '1';

export type SourceFile = {
  readonly path: string;
  readonly text: string;
};

export type FileCounts = Readonly<Record<string, number>>;

const walk = (directory: string): ReadonlyArray<string> => {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory).flatMap((entry) => {
    if (SKIPPED_DIRECTORIES.has(entry)) {
      return [];
    }
    const full = join(directory, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
};

export const productSources = (): ReadonlyArray<SourceFile> =>
  [join(REPO_ROOT, 'apps', 'desktop', 'src'), join(REPO_ROOT, 'packages', 'ui', 'src')]
    .flatMap(walk)
    .filter((full) => /\.tsx?$/.test(full) && !/\.test\.tsx?$/.test(full))
    .map((full) => ({
      path: relative(REPO_ROOT, full).split(sep).join('/'),
      text: readFileSync(full, 'utf8'),
    }))
    .sort((left, right) => left.path.localeCompare(right.path));

type TagParams = {
  readonly text: string;
  readonly name: string;
};

export const openingTags = ({ text, name }: TagParams): ReadonlyArray<string> => {
  const found: string[] = [];
  const opener = new RegExp(`<${name}(?![A-Za-z0-9])`, 'g');
  for (const match of text.matchAll(opener)) {
    let depth = 0;
    let cursor = match.index + match[0].length;
    while (cursor < text.length) {
      const char = text[cursor];
      depth += char === '{' ? 1 : char === '}' ? -1 : 0;
      if (char === '>' && depth === 0 && text[cursor - 1] !== '=') {
        break;
      }
      cursor += 1;
    }
    found.push(text.slice(match.index, cursor + 1));
  }
  return found;
};

export const countMatches = ({
  text,
  pattern,
}: {
  readonly text: string;
  readonly pattern: RegExp;
}): number => (text.match(pattern) ?? []).length;

const isCounts = (value: unknown): value is FileCounts =>
  typeof value === 'object' &&
  value !== null &&
  Object.values(value).every((count) => typeof count === 'number');

export const readBaseline = ({ file }: { readonly file: string }): FileCounts => {
  const path = join(__dirname, file);
  if (!existsSync(path)) {
    return {};
  }
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  return isCounts(parsed) ? parsed : {};
};

export const writeBaseline = ({
  file,
  counts,
}: {
  readonly file: string;
  readonly counts: FileCounts;
}): void => {
  writeFileSync(join(__dirname, file), `${JSON.stringify(counts, null, 2)}\n`);
};

export const grownEntries = ({
  current,
  baseline,
}: {
  readonly current: FileCounts;
  readonly baseline: FileCounts;
}): ReadonlyArray<string> =>
  Object.entries(current).flatMap(([path, count]) => {
    const allowed = baseline[path] ?? 0;
    return count > allowed ? [`  - ${path}: ${count} (baseline ${allowed})`] : [];
  });

export const nonZero = ({ counts }: { readonly counts: FileCounts }): FileCounts =>
  Object.fromEntries(Object.entries(counts).filter(([, count]) => count > 0));
