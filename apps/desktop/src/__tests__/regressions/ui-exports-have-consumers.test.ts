// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join, relative, resolve, sep } from 'path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const UI_SRC = join(REPO_ROOT, 'packages', 'ui', 'src');
const BARREL = join(UI_SRC, 'index.ts');
const BASELINE_PATH = join(__dirname, 'ui-exports-have-consumers.baseline.json');
const isUpdatingBaseline = process.env.GOODBOY_UPDATE_BASELINE === '1';

const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set(['node_modules', 'dist', 'target', 'gen']);
const VALUE_EXPORT = /export\s+\{([^}]*)\}\s+from\s+'([^']+)'/g;

type Counts = Readonly<Record<string, number>>;

type Source = {
  readonly path: string;
  readonly text: string;
};

type Export = {
  readonly name: string;
  readonly from: string;
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

const isProductSource = (path: string): boolean =>
  /\.tsx?$/.test(path) &&
  !/\.test\.tsx?$/.test(path) &&
  !path.split(sep).includes('__tests__') &&
  path !== BARREL;

const sources = (): ReadonlyArray<Source> =>
  [join(REPO_ROOT, 'apps', 'desktop', 'src'), UI_SRC]
    .flatMap(walk)
    .filter(isProductSource)
    .map((path) => ({ path, text: readFileSync(path, 'utf8') }));

const valueExportsOf = ({ barrel }: { readonly barrel: string }): ReadonlyArray<Export> =>
  [...barrel.matchAll(VALUE_EXPORT)].flatMap((match) =>
    (match[1] ?? '')
      .split(',')
      .map((part) => part.trim())
      .filter((part) => part !== '' && !part.startsWith('type '))
      .map((part) => ({ name: part.split(/\s+as\s+/).pop() ?? part, from: match[2] ?? '' })),
  );

const isOwnModule = ({ path, from }: { readonly path: string; readonly from: string }): boolean => {
  const base = resolve(UI_SRC, from);
  return (
    path === base ||
    path === `${base}.ts` ||
    path === `${base}.tsx` ||
    path.startsWith(`${base}${sep}`)
  );
};

const hasConsumer = ({
  entry,
  all,
}: {
  readonly entry: Export;
  readonly all: ReadonlyArray<Source>;
}): boolean => {
  const word = new RegExp(`(?<![\\w$])${entry.name}(?![\\w$])`);
  return all.some(
    ({ path, text }) => isOwnModule({ path, from: entry.from }) === false && word.test(text),
  );
};

const measure = (): Counts => {
  const all = sources();
  const barrel = readFileSync(BARREL, 'utf8');
  return Object.fromEntries(
    valueExportsOf({ barrel })
      .filter((entry) => hasConsumer({ entry, all }) === false)
      .map((entry) => [entry.name, 1] as const)
      .sort(([left], [right]) => left.localeCompare(right)),
  );
};

const isCounts = (value: unknown): value is Counts =>
  typeof value === 'object' &&
  value !== null &&
  Object.values(value).every((count) => typeof count === 'number');

const readBaseline = (): Counts => {
  if (!existsSync(BASELINE_PATH)) {
    return {};
  }
  const parsed: unknown = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  return isCounts(parsed) ? parsed : {};
};

describe('every ui export has a consumer or goes away with its test', () => {
  it('reads the value exports of the barrel and tells a used one from an unused one', () => {
    const barrel = `export { Used } from './components/Used';\nexport type { Props } from './x';\nexport { Lonely, type Kind } from './components/Lonely';`;
    const exports = valueExportsOf({ barrel });

    expect(exports.map((entry) => entry.name)).toEqual(['Used', 'Lonely']);
    const all = [{ path: join(UI_SRC, 'elsewhere.tsx'), text: 'const x = <Used />;' }];
    expect(hasConsumer({ entry: { name: 'Used', from: './components/Used' }, all })).toBe(true);
    expect(hasConsumer({ entry: { name: 'Lonely', from: './components/Lonely' }, all })).toBe(
      false,
    );
    expect(
      hasConsumer({
        entry: { name: 'Used', from: './components/Used' },
        all: [{ path: join(UI_SRC, 'components', 'Used.tsx'), text: 'export const Used = 1;' }],
      }),
    ).toBe(false);
  });

  it('adds no ui export without a consumer beyond the baseline, which only falls', () => {
    const current = measure();
    if (isUpdatingBaseline) {
      writeFileSync(BASELINE_PATH, `${JSON.stringify(current, null, 2)}\n`);
      return;
    }
    const baseline = readBaseline();
    const grown = Object.keys(current).filter((name) => baseline[name] === undefined);
    if (grown.length > 0) {
      throw new Error(
        `A packages/ui export has no consumer in apps/desktop or packages/ui. Use it where a hand ` +
          `copy exists, or delete the export with its component, its test and its doc line ` +
          `(AGENTS.md, Docs move with the code). The baseline only falls.\n\n` +
          `${grown.map((name) => `  - ${name}`).join('\n')}`,
      );
    }
    const freed = Object.keys(baseline).filter((name) => current[name] === undefined);
    expect(
      freed,
      `Lower ui-exports-have-consumers.baseline.json (delete these names): ${relative(REPO_ROOT, BASELINE_PATH)}`,
    ).toEqual([]);
  });
});
