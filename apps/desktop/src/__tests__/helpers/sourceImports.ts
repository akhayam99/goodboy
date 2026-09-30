import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join, normalize, relative, sep } from 'path';

export const DESKTOP_SRC = join(__dirname, '..', '..');

const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set(['node_modules', 'dist', 'gen']);
const RELATIVE_SPECIFIER =
  /(?:\bfrom\s*|\bimport\s*\(\s*|\bvi\.(?:mock|doMock|importActual)\s*\(\s*)(['"])(\.{1,2}\/[^'"]*)\1/g;

export type SourceImport = {
  readonly from: string;
  readonly target: string;
};

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

const toPath = (full: string): string => relative(DESKTOP_SRC, full).split(sep).join('/');

export const isTestSource = (path: string): boolean =>
  /\.test\.tsx?$/.test(path) ||
  path.startsWith('__tests__/') ||
  path.startsWith('test/') ||
  path.endsWith('/storyHarness.ts');

export const desktopSources = (): ReadonlyArray<string> =>
  walk(DESKTOP_SRC)
    .map(toPath)
    .filter((path) => /\.tsx?$/.test(path) && !path.endsWith('.d.ts'));

export const importsOf = ({ path, text }: { readonly path: string; readonly text: string }) =>
  [...text.matchAll(RELATIVE_SPECIFIER)].map((match): SourceImport => ({
    from: path,
    target: normalize(join(dirname(path), match[2] ?? ''))
      .split(sep)
      .join('/'),
  }));

export const importsInSources = (paths: ReadonlyArray<string>): ReadonlyArray<SourceImport> =>
  paths.flatMap((path) => importsOf({ path, text: readFileSync(join(DESKTOP_SRC, path), 'utf8') }));
