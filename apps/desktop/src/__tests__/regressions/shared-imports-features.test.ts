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

const BASELINE_PATH = join(__dirname, 'shared-imports-features.baseline.json');
const KEY_PREFIX = 'apps/desktop/src/';

const isSharedToFeature = ({ from, target }: SourceImport): boolean =>
  from.startsWith('shared/') && target.startsWith('features/');

const measure = (): Counts => {
  const counts: Record<string, number> = {};
  const imports = importsInSources(
    desktopSources().filter((path) => path.startsWith('shared/') && !isTestSource(path)),
  );
  for (const { from } of imports.filter(isSharedToFeature)) {
    const key = `${KEY_PREFIX}${from}`;
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

describe('shared code does not import a feature', () => {
  it('reads an import from shared into features, and nothing else', () => {
    const text = [
      "import { A } from '../../../features/providers/providerLabel';",
      "import { B } from '../../utils/pluralize';",
      "import { C } from '../../../app/components/Toast';",
    ].join('\n');
    const found = importsOf({ path: 'shared/components/RoutingPicker/Row.tsx', text });
    expect(found.filter(isSharedToFeature).map(({ target }) => target)).toEqual([
      'features/providers/providerLabel',
    ]);
  });

  it('finds the files the baseline knows, never an empty sweep', () => {
    expect(Object.keys(measure()).length).toBeGreaterThan(0);
  });

  it('adds no import from shared into a feature, and lowers the baseline when a file shrinks', () => {
    const actual = measure();
    if (IS_UPDATING) {
      writeFileSync(BASELINE_PATH, `${JSON.stringify(actual, null, 2)}\n`);
      return;
    }
    const baseline = readBaseline();
    const keys = [...new Set([...Object.keys(actual), ...Object.keys(baseline)])].sort();
    const drifted = keys
      .filter((key) => (actual[key] ?? 0) !== (baseline[key] ?? 0))
      .map((key) => `${key}: ${actual[key] ?? 0} now, ${baseline[key] ?? 0} in the baseline`);
    expect(
      drifted,
      'shared/ is the layer under features/. Move the imported part down to shared/, or move the shared module into the one feature that owns it (docs/file-system.md, Boundaries between layers). The baseline only falls.',
    ).toEqual([]);
  });
});
