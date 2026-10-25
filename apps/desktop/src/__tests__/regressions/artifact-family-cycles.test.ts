// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  desktopSources,
  importsInSources,
  importsOf,
  isTestSource,
  type SourceImport,
} from '../helpers/sourceImports';
import {
  IS_UPDATING,
  grownEntries,
  readBaseline,
  writeBaseline,
  type FileCounts,
} from './scanControls';

const BASELINE_FILE = 'artifact-family-cycles.baseline.json';
const FAMILY: ReadonlySet<string> = new Set(['artifacts', 'plans', 'reports', 'wireframes']);
const FEATURE_PATH = new RegExp('^features/([^/]+)/');

type PairParams = {
  readonly imports: ReadonlyArray<SourceImport>;
};

const featureOf = (path: string): string | null => FEATURE_PATH.exec(path)?.[1] ?? null;

const isFamilyImport = ({ from, target }: SourceImport): boolean => {
  const owner = featureOf(from);
  const targetFeature = featureOf(target);
  return (
    owner !== null &&
    targetFeature !== null &&
    owner !== targetFeature &&
    FAMILY.has(owner) &&
    FAMILY.has(targetFeature)
  );
};

const countPairs = ({ imports }: PairParams): Readonly<Record<string, number>> => {
  const counts: Record<string, number> = {};
  for (const { from, target } of imports.filter(isFamilyImport)) {
    const key = `${featureOf(from)} -> ${featureOf(target)}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
};

const cyclicPairs = ({ imports }: PairParams): FileCounts => {
  const counts = countPairs({ imports });
  return Object.fromEntries(
    Object.entries(counts)
      .filter(([key]) => {
        const [from, to] = key.split(' -> ');
        return counts[`${to} -> ${from}`] !== undefined;
      })
      .sort(([left], [right]) => left.localeCompare(right)),
  );
};

const productImports = (): ReadonlyArray<SourceImport> =>
  importsInSources(desktopSources().filter((path) => !isTestSource(path)));

describe('artifacts, plans, reports and wireframes do not import each other in cycles', () => {
  it('finds a pair that imports both ways and leaves a one-way pair alone', () => {
    const toPlans = importsOf({
      path: 'features/artifacts/artifactListRows.ts',
      text: "import { A } from '../plans/planOwnerOf';",
    });
    const toArtifacts = importsOf({
      path: 'features/plans/usePlanModel/index.ts',
      text: "import { B } from '../../artifacts/artifactStateOf';",
    });
    const toReports = importsOf({
      path: 'features/artifacts/artifactActionRuns.ts',
      text: "import { C } from '../reports/reportTypes';",
    });

    expect(cyclicPairs({ imports: [...toPlans, ...toArtifacts, ...toReports] })).toEqual({
      'artifacts -> plans': 1,
      'plans -> artifacts': 1,
    });
  });

  it('finds the cycles the baseline knows, never an empty sweep', () => {
    expect(Object.keys(cyclicPairs({ imports: productImports() })).length).toBeGreaterThan(0);
  });

  it('adds no cycle and no import to one, and lowers the baseline when a pair shrinks', () => {
    const current = cyclicPairs({ imports: productImports() });
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const baseline = readBaseline({ file: BASELINE_FILE });
    const grown = grownEntries({ current, baseline });
    const stale = Object.entries(baseline)
      .filter(([key, allowed]) => (current[key] ?? 0) < allowed)
      .map(([key, allowed]) => `  - ${key}: now ${current[key] ?? 0}, baseline ${allowed}`);
    expect(
      [...grown, ...stale],
      `A kind of artifact (plans, reports, wireframes) builds on the artifacts shell, and the shell may know the kinds only through a registry (artifactSurfaces.ts). An import that closes a cycle, or one more across an existing cycle, fails. Lower or delete a pair in artifact-family-cycles.baseline.json when it shrinks.\n${[...grown, ...stale].join('\n')}`,
    ).toEqual([]);
  });
});
