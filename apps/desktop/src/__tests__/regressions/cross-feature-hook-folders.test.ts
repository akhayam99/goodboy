// @vitest-environment node
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  desktopSources,
  importsInSources,
  importsOf,
  isTestSource,
  type SourceImport,
} from '../helpers/sourceImports';
import { IS_UPDATING } from './scanControls';

type Counts = Readonly<Record<string, number>>;

const BASELINE_PATH = join(__dirname, 'cross-feature-hook-folders.baseline.json');

const FEATURE_PATH = new RegExp('^features/([^/]+)/');

const featureOf = (path: string): string | null => FEATURE_PATH.exec(path)?.[1] ?? null;

const isDeepSegment = (segment: string): boolean => segment === 'components' || segment === 'hooks';

const isHookFolderImport = ({ from, target }: SourceImport): boolean => {
  const owner = featureOf(from);
  const targetFeature = featureOf(target);
  if (owner === null || targetFeature === null || owner === targetFeature) {
    return false;
  }
  const inside = target.split('/').slice(2);
  if (inside.some(isDeepSegment)) {
    return false;
  }
  return /^use[A-Z]/.test(inside[0] ?? '');
};

const measure = (): Counts => {
  const counts: Record<string, number> = {};
  const imports = importsInSources(desktopSources().filter((path) => !isTestSource(path)));
  for (const { from, target } of imports.filter(isHookFolderImport)) {
    const key = `${featureOf(from)} -> ${featureOf(target)}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
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

const describeKeys = ({
  actual,
  baseline,
  keys,
}: {
  readonly actual: Counts;
  readonly baseline: Counts;
  readonly keys: ReadonlyArray<string>;
}): ReadonlyArray<string> =>
  keys.map((key) => `${key}: ${actual[key] ?? 0} now, ${baseline[key] ?? 0} in the baseline`);

describe('a feature does not reach into a hook folder of another feature', () => {
  it('reads a root hook folder import across features, and nothing else', () => {
    const text = [
      "import { A } from '../../actions/useActionControls';",
      "import { B } from '../../actions/useActionControls/helper';",
      "import { C } from '../../workflows/hooks/useThing';",
      "import { D } from '../../workflows/activeWorkflowRuns';",
      "import { E } from '../useLocal';",
    ].join('\n');
    const found = importsOf({ path: 'features/history/components/Prompt.tsx', text });
    expect(found.filter(isHookFolderImport).map(({ target }) => target)).toEqual([
      'features/actions/useActionControls',
      'features/actions/useActionControls/helper',
    ]);
  });

  it('finds the pairs the baseline knows, never an empty sweep', () => {
    expect(Object.keys(measure()).length).toBeGreaterThan(0);
  });

  it('adds no pair and no import beyond the baseline, and lowers it when a pair shrinks', () => {
    const actual = measure();
    if (IS_UPDATING) {
      writeFileSync(BASELINE_PATH, `${JSON.stringify(actual, null, 2)}\n`);
      return;
    }
    const baseline = readBaseline();
    const keys = [...new Set([...Object.keys(actual), ...Object.keys(baseline)])].sort();
    const drifted = keys.filter((key) => (actual[key] ?? 0) !== (baseline[key] ?? 0));
    expect(
      describeKeys({ actual, baseline, keys: drifted }),
      'A feature imports a use* hook folder at the root of another feature. Move the hook to shared/hooks or to the feature that owns it. Lower or delete a pair in cross-feature-hook-folders.baseline.json when it shrinks; it never grows.',
    ).toEqual([]);
  });
});
