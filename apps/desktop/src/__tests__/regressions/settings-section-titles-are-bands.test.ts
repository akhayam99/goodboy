// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  IS_UPDATING,
  grownEntries,
  nonZero,
  openingTags,
  productSources,
  readBaseline,
  writeBaseline,
  type FileCounts,
} from './scanControls';

const BASELINE_FILE = 'settings-section-titles-are-bands.baseline.json';
const SETTINGS_PAGE_ROOTS: ReadonlyArray<string> = [
  'apps/desktop/src/features/settings/components/SettingsStudio/',
  'apps/desktop/src/features/backup/components/BackupPage/',
];
const RAIL_FILE = /\/SettingsRail[A-Za-z]*\.tsx$/;

type PathParams = {
  readonly path: string;
};

type TextParams = {
  readonly text: string;
};

const isSettingsPage = ({ path }: PathParams): boolean =>
  SETTINGS_PAGE_ROOTS.some((root) => path.startsWith(root)) && !RAIL_FILE.test(path);

const eyebrowTitles = ({ text }: TextParams): number =>
  openingTags({ text, name: 'Eyebrow' }).length;

const measure = (): FileCounts =>
  nonZero({
    counts: Object.fromEntries(
      productSources()
        .filter(({ path }) => isSettingsPage({ path }))
        .map(({ path, text }) => [path, eyebrowTitles({ text })]),
    ),
  });

describe('a settings page names its groups with a band', () => {
  it('counts an Eyebrow on a page and leaves the rail group labels alone', () => {
    expect(eyebrowTitles({ text: '<h2><Eyebrow label="Reset" /></h2>' })).toBe(1);
    expect(eyebrowTitles({ text: '<Band label="Danger zone">' })).toBe(0);
    expect(
      isSettingsPage({
        path: 'apps/desktop/src/features/settings/components/SettingsStudio/SettingsRailFold.tsx',
      }),
    ).toBe(false);
    expect(
      isSettingsPage({
        path: 'apps/desktop/src/features/backup/components/BackupPage/index.tsx',
      }),
    ).toBe(true);
  });

  it('adds no Eyebrow section title beyond the baseline', () => {
    const current = measure();
    if (IS_UPDATING) {
      writeBaseline({ file: BASELINE_FILE, counts: current });
      return;
    }
    const grown = grownEntries({ current, baseline: readBaseline({ file: BASELINE_FILE }) });
    expect(
      grown,
      `Put the rows in a Band with a label instead of an Eyebrow or a bare section title.\n${grown.join('\n')}`,
    ).toEqual([]);
  });
});
