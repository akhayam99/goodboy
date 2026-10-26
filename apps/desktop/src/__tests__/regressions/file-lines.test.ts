// @vitest-environment node
import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';
import { describe, expect, it } from 'vitest';
import {
  IS_UPDATING,
  grownEntries,
  readBaseline,
  writeBaseline,
  type FileCounts,
} from './scanControls';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const PRODUCT_BASELINE = 'file-lines.baseline.json';
const TEST_BASELINE = 'test-file-lines.baseline.json';
const COMPONENT_CEILING = 250;
const MODULE_CEILING = 600;
const TEST_CEILING = 1000;

const SKIPPED_DIRECTORIES: ReadonlySet<string> = new Set([
  'node_modules',
  'dist',
  'target',
  'gen',
  '__tests__',
  'testing',
  'MockScene',
]);

type CeilingParams = {
  readonly path: string;
};

type CountParams = {
  readonly text: string;
};

type WalkParams = {
  readonly directory: string;
};

type PathParams = {
  readonly full: string;
};

const walk = ({ directory }: WalkParams): ReadonlyArray<string> => {
  if (!existsSync(directory)) {
    return [];
  }
  return readdirSync(directory).flatMap((entry) => {
    if (entry === 'node_modules' || entry === 'dist' || entry === 'target' || entry === 'gen') {
      return [];
    }
    const full = join(directory, entry);
    return statSync(full).isDirectory() ? walk({ directory: full }) : [full];
  });
};

const toPath = ({ full }: PathParams): string => relative(REPO_ROOT, full).split(sep).join('/');

const sourceRoots = (): ReadonlyArray<string> => [
  join(REPO_ROOT, 'apps', 'desktop', 'src'),
  ...readdirSync(join(REPO_ROOT, 'packages')).map((name) =>
    join(REPO_ROOT, 'packages', name, 'src'),
  ),
];

const countCodeLines = ({ text }: CountParams): number => {
  let isInBlock = false;
  let count = 0;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (isInBlock) {
      isInBlock = !line.includes('*/');
      continue;
    }
    if (line === '' || line.startsWith('//')) {
      continue;
    }
    if (line.startsWith('/*')) {
      isInBlock = !line.includes('*/');
      continue;
    }
    count += 1;
  }
  return count;
};

const ceilingOf = ({ path }: CeilingParams): number =>
  path.endsWith('.tsx') ? COMPONENT_CEILING : MODULE_CEILING;

const isProductPath = ({ full }: PathParams): boolean => {
  const parts = toPath({ full }).split('/');
  const name = parts[parts.length - 1] ?? '';
  const isSource = /\.(ts|tsx)$/.test(name) && !/\.(test|d)\.tsx?$/.test(name);
  const isScript = parts[0] === 'scripts' && name.endsWith('.mjs') && !name.endsWith('.test.mjs');
  if (!isSource && !isScript) {
    return false;
  }
  if (name === 'storyHarness.ts') {
    return false;
  }
  return !parts.some((part) => SKIPPED_DIRECTORIES.has(part));
};

const staleEntries = ({
  current,
  baseline,
}: {
  readonly current: FileCounts;
  readonly baseline: FileCounts;
}): ReadonlyArray<string> =>
  Object.entries(baseline).flatMap(([path, allowed]) => {
    const now = current[path] ?? 0;
    return now < allowed ? [`  - ${path}: now ${now}, baseline ${allowed}`] : [];
  });

const measureProduct = (): FileCounts =>
  Object.fromEntries(
    [...sourceRoots(), join(REPO_ROOT, 'scripts')]
      .flatMap((directory) => walk({ directory }))
      .filter((full) => isProductPath({ full }))
      .flatMap((full) => {
        const path = toPath({ full });
        const lines = countCodeLines({ text: readFileSync(full, 'utf8') });
        return lines > ceilingOf({ path }) ? [[path, lines] as const] : [];
      })
      .sort(([left], [right]) => left.localeCompare(right)),
  );

const measureTests = (): FileCounts =>
  Object.fromEntries(
    sourceRoots()
      .flatMap((directory) => walk({ directory }))
      .filter((full) => /\.test\.tsx?$/.test(full))
      .flatMap((full) => {
        const lines = countCodeLines({ text: readFileSync(full, 'utf8') });
        return lines > TEST_CEILING ? [[toPath({ full }), lines] as const] : [];
      })
      .sort(([left], [right]) => left.localeCompare(right)),
  );

describe('a file only ever shrinks toward the size the folder rule allows', () => {
  it('skips blank lines and comment lines when it counts', () => {
    const text = [
      '',
      'const a = 1;',
      '// note',
      '/* one */',
      '/*',
      ' * two',
      ' */',
      'const b = 2;',
    ];
    expect(countCodeLines({ text: text.join('\n') })).toBe(2);
  });

  it('holds a component to 250 lines and any other module to 600', () => {
    expect(ceilingOf({ path: 'apps/desktop/src/features/x/Panel.tsx' })).toBe(250);
    expect(ceilingOf({ path: 'apps/desktop/src/features/x/panel.ts' })).toBe(600);
    expect(ceilingOf({ path: 'scripts/check-rules.mjs' })).toBe(600);
  });

  it('finds the oversized files, never an empty sweep', () => {
    expect(Object.keys(measureProduct()).length).toBeGreaterThan(0);
    expect(Object.keys(measureTests()).length).toBeGreaterThan(0);
  });

  it('lets no product file grow past its baseline or cross its ceiling', () => {
    const current = measureProduct();
    if (IS_UPDATING) {
      writeBaseline({ file: PRODUCT_BASELINE, counts: current });
      return;
    }
    const grown = grownEntries({ current, baseline: readBaseline({ file: PRODUCT_BASELINE }) });
    expect(
      grown,
      `A component past ${COMPONENT_CEILING} lines or another module past ${MODULE_CEILING} is split by the folder rule in docs/file-system.md (a component becomes a folder with one file per piece, a module a package folder). Blank lines and comment lines are not counted. The baseline only falls.\n${grown.join('\n')}`,
    ).toEqual([]);
  });

  it('keeps the baselines no higher than the files they list', () => {
    const stale = [
      ...staleEntries({
        current: measureProduct(),
        baseline: readBaseline({ file: PRODUCT_BASELINE }),
      }),
      ...staleEntries({ current: measureTests(), baseline: readBaseline({ file: TEST_BASELINE }) }),
    ];
    expect(
      IS_UPDATING ? [] : stale,
      `A file shrank or left the list: lower its entry with GOODBOY_UPDATE_BASELINE=1 pnpm --filter @goodboy/desktop exec vitest run src/__tests__/regressions/file-lines.test.ts\n${stale.join('\n')}`,
    ).toEqual([]);
  });

  it('lets no test file grow past its baseline or cross 1,000 lines', () => {
    const current = measureTests();
    if (IS_UPDATING) {
      writeBaseline({ file: TEST_BASELINE, counts: current });
      return;
    }
    const grown = grownEntries({ current, baseline: readBaseline({ file: TEST_BASELINE }) });
    expect(
      grown,
      `A test file past ${TEST_CEILING} lines is split by behavior, one file per scenario group (docs/testing.md). Blank lines and comment lines are not counted. The baseline only falls.\n${grown.join('\n')}`,
    ).toEqual([]);
  });
});
