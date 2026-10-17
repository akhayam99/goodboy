// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..');
const SCANNED_ROOTS = ['features', 'app', 'shared'];
const FILTER_BUTTON = 'shared/components/FilterButton/index.tsx';

const LUCIDE_IMPORT = /import\s*\{([^}]*)\}\s*from\s*'lucide-react'/g;

const FILTER_GLYPHS: ReadonlySet<string> = new Set([
  'Filter',
  'FilterX',
  'Funnel',
  'FunnelPlus',
  'FunnelX',
  'ListFilter',
  'ListFilterPlus',
]);

const ALLOWED: Readonly<Record<string, string>> = {
  'features/workspace/components/SessionActivityBar/SessionFilterPopover/index.tsx':
    'icon-only xs trigger in the sidebar header, with its attention dot',
  'features/diff/components/ChangeTree/FilterMenu.tsx':
    'icon-only xs trigger in the file tree header, toned while a filter is on',
};

const isSource = (path: string): boolean =>
  /\.(ts|tsx)$/.test(path) &&
  !/\.test\.(ts|tsx)$/.test(path) &&
  !path.includes(`${sep}__tests__${sep}`) &&
  !path.includes(`${sep}MockScene${sep}`);

const walk = (dir: string): ReadonlyArray<string> =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return walk(path);
    }
    return isSource(path) ? [path] : [];
  });

type SourceParams = {
  readonly source: string;
};

const importsFilterGlyph = ({ source }: SourceParams): boolean =>
  [...source.matchAll(LUCIDE_IMPORT)].some((match) =>
    (match[1] ?? '')
      .split(',')
      .map(
        (name) =>
          name
            .trim()
            .replace(/^type\s+/, '')
            .split(/\s+as\s+/)[0] ?? '',
      )
      .some((name) => FILTER_GLYPHS.has(name)),
  );

const offenders = (): ReadonlyArray<string> =>
  SCANNED_ROOTS.flatMap((root) => walk(join(SRC, root)))
    .map((path) => relative(SRC, path).split(sep).join('/'))
    .filter((path) => path !== FILTER_BUTTON)
    .filter((path) => importsFilterGlyph({ source: readFileSync(join(SRC, path), 'utf8') }));

describe('filter triggers', () => {
  it('render through the shared FilterButton, past an allowlist that only falls', () => {
    const found = offenders();

    expect(found.filter((path) => ALLOWED[path] === undefined)).toEqual([]);
    expect(Object.keys(ALLOWED).filter((path) => !found.includes(path))).toEqual([]);
  });

  it('keeps the lines icon on FilterButton, never the funnel', () => {
    const source = readFileSync(join(SRC, FILTER_BUTTON), 'utf8');

    expect(source).toContain('ListFilter');
    expect(source).not.toMatch(/\bFunnel\b/);
  });
});
