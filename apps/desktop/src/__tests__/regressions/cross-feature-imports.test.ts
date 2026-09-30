// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  desktopSources,
  importsInSources,
  importsOf,
  isTestSource,
  type SourceImport,
} from '../helpers/sourceImports';

type Baseline = {
  readonly deepImportsByPair: Readonly<Record<string, number>>;
  readonly shellImportsByFile: Readonly<Record<string, number>>;
};

const BASELINE: Baseline = JSON.parse(
  readFileSync(join(__dirname, 'cross-feature-imports.baseline.json'), 'utf8'),
);

const featureOf = (path: string): string | null => /^features\/([^/]+)\//.exec(path)?.[1] ?? null;

const isDeepSegment = (segment: string): boolean => segment === 'components' || segment === 'hooks';

const isDeepImport = ({ from, target }: SourceImport): boolean => {
  const owner = featureOf(from);
  const targetFeature = featureOf(target);
  if (owner === null || targetFeature === null || owner === targetFeature) {
    return false;
  }
  return target.split('/').slice(2).some(isDeepSegment);
};

const isShellImport = ({ from, target }: SourceImport): boolean =>
  featureOf(from) !== null && /^app(?:\/|$)/.test(target);

const tally = (keys: ReadonlyArray<string>): Readonly<Record<string, number>> =>
  keys.reduce<Record<string, number>>(
    (counts, key) => ({ ...counts, [key]: (counts[key] ?? 0) + 1 }),
    {},
  );

const productImports = (): ReadonlyArray<SourceImport> =>
  importsInSources(desktopSources().filter((path) => !isTestSource(path)));

const measureDeep = (imports: ReadonlyArray<SourceImport>): Readonly<Record<string, number>> =>
  tally(
    imports
      .filter(isDeepImport)
      .map(({ from, target }) => `${featureOf(from)} -> ${featureOf(target)}`),
  );

const measureShell = (imports: ReadonlyArray<SourceImport>): Readonly<Record<string, number>> =>
  tally(imports.filter(isShellImport).map(({ from }) => from));

const sum = (counts: Readonly<Record<string, number>>): number =>
  Object.values(counts).reduce((total, count) => total + count, 0);

const drift = ({
  actual,
  baseline,
}: {
  readonly actual: Readonly<Record<string, number>>;
  readonly baseline: Readonly<Record<string, number>>;
}) => {
  const keys = [...new Set([...Object.keys(actual), ...Object.keys(baseline)])].sort();
  return {
    grew: keys.filter((key) => (actual[key] ?? 0) > (baseline[key] ?? 0)),
    stale: keys.filter((key) => (actual[key] ?? 0) < (baseline[key] ?? 0)),
  };
};

const describeDrift = ({
  actual,
  baseline,
  keys,
}: {
  readonly actual: Readonly<Record<string, number>>;
  readonly baseline: Readonly<Record<string, number>>;
  readonly keys: ReadonlyArray<string>;
}): ReadonlyArray<string> =>
  keys.map((key) => `${key}: ${actual[key] ?? 0} now, ${baseline[key] ?? 0} in the baseline`);

describe('cross-feature imports only ever shrink', () => {
  it('reads component and hook imports from another feature, and nothing else', () => {
    const text = [
      "import { A } from '../../../workflows/components/Panel';",
      "import { B } from '../../../workflows/hooks/useThing';",
      "import { C } from '../../../integrations/github/components/PullRequest/PrChecks';",
      "import { D } from '../../../workflows/activeWorkflowRuns';",
      "import { E } from '../../components/Local';",
      "import { F } from '../../../../shared/components/Toast';",
      "import { G } from '../../../../app/components/AppFooter/categories';",
    ].join('\n');
    const found = importsOf({ path: 'features/session/components/Pane/index.tsx', text });

    expect(found.filter(isDeepImport).map(({ target }) => target)).toEqual([
      'features/workflows/components/Panel',
      'features/workflows/hooks/useThing',
      'features/integrations/github/components/PullRequest/PrChecks',
    ]);
    expect(found.filter(isShellImport).map(({ target }) => target)).toEqual([
      'app/components/AppFooter/categories',
    ]);
  });

  it('counts product code only and finds the pairs the baseline knows', () => {
    const deep = measureDeep(productImports());

    expect(sum(deep)).toBeGreaterThan(100);
    expect(deep['session -> workflows']).toBeGreaterThan(0);
  });

  it('never adds a deep import from one feature into another feature components or hooks', () => {
    const actual = measureDeep(productImports());
    const { grew } = drift({ actual, baseline: BASELINE.deepImportsByPair });

    expect(
      describeDrift({ actual, baseline: BASELINE.deepImportsByPair, keys: grew }),
      'A feature reaches into another feature components/ or hooks/. Move the shared code to shared/ or to the owning feature module, or lower the count you added.',
    ).toEqual([]);
  });

  it('lowers the baseline when a pair shrinks, so the freed room cannot be spent again', () => {
    const actual = measureDeep(productImports());
    const { stale } = drift({ actual, baseline: BASELINE.deepImportsByPair });

    expect(
      describeDrift({ actual, baseline: BASELINE.deepImportsByPair, keys: stale }),
      'Lower these counts in cross-feature-imports.baseline.json (delete the pair at 0).',
    ).toEqual([]);
  });

  it('keeps features from importing the app shell, file by file', () => {
    const actual = measureShell(productImports());
    const { grew, stale } = drift({ actual, baseline: BASELINE.shellImportsByFile });

    expect(
      describeDrift({ actual, baseline: BASELINE.shellImportsByFile, keys: [...grew, ...stale] }),
      'A feature imports app/. Shared code belongs in shared/. Lower or delete a stale entry in cross-feature-imports.baseline.json.',
    ).toEqual([]);
  });
});
