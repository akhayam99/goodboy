// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = join(__dirname, '..', '..', '..', '..', '..');
const REVIEWED_FILES = join(__dirname, '..', '..', 'features', 'diff', 'lib', 'reviewedFiles.ts');
const LEGACY_UNTIL = /LEGACY_REVIEWED_KEY_UNTIL = '([^']+)'/;
const VERSION_PART = /^(\d+)\.(\d+)\.(\d+)/;

type VersionParams = {
  readonly version: string;
};

type CompareParams = {
  readonly left: string;
  readonly right: string;
};

type TextParams = {
  readonly text: string;
};

const partsOf = ({ version }: VersionParams): ReadonlyArray<number> => {
  const match = VERSION_PART.exec(version);
  return match === null ? [0, 0, 0] : [Number(match[1]), Number(match[2]), Number(match[3])];
};

const compareVersions = ({ left, right }: CompareParams): number => {
  const a = partsOf({ version: left });
  const b = partsOf({ version: right });
  for (let index = 0; index < 3; index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) {
      return difference;
    }
  }
  return 0;
};

const retiredRows = ({ text }: TextParams): ReadonlyArray<{ state: string; until: string }> => {
  const section = text.split('## Retired state')[1]?.split('\n## ')[0] ?? '';
  return section
    .split('\n')
    .filter((line) => line.startsWith('| ') && !line.startsWith('| State') && !line.includes('---'))
    .map((line) => line.split('|').map((cell) => cell.trim()))
    .map((cells) => ({ state: cells[1] ?? '', until: cells[4] ?? '' }));
};

describe('an old state shape is read only until the release the doc names', () => {
  it('reads the rows of the retired state table', () => {
    const text = [
      '## Retired state',
      '',
      '| State | Old shape | New shape written since | Old shape read until (excluded) |',
      '| ----- | --------- | ----------------------- | ------------------------------- |',
      '| key `a` | no mount | 0.18.1 | 0.30.0 |',
      '',
      '## Major',
    ].join('\n');

    expect(retiredRows({ text })).toEqual([{ state: 'key `a`', until: '0.30.0' }]);
  });

  it('compares versions part by part', () => {
    expect(compareVersions({ left: '0.28.8', right: '0.30.0' })).toBeLessThan(0);
    expect(compareVersions({ left: '0.30.0', right: '0.30.0' })).toBe(0);
    expect(compareVersions({ left: '0.100.0', right: '0.30.0' })).toBeGreaterThan(0);
  });

  it('names the same release for the diff reviewed key in the code and in the doc', () => {
    const rows = retiredRows({
      text: readFileSync(join(REPO_ROOT, 'docs', 'versioning.md'), 'utf8'),
    });
    const row = rows.find((entry) => entry.state.includes('diffReviewed'));

    expect(row?.until).toBe(LEGACY_UNTIL.exec(readFileSync(REVIEWED_FILES, 'utf8'))?.[1]);
  });

  it('keeps no row past the release that stops reading its old shape', () => {
    const manifest: unknown = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));
    const version =
      typeof manifest === 'object' &&
      manifest !== null &&
      'version' in manifest &&
      typeof manifest.version === 'string'
        ? manifest.version
        : '0.0.0';
    const rows = retiredRows({
      text: readFileSync(join(REPO_ROOT, 'docs', 'versioning.md'), 'utf8'),
    });
    const overdue = rows
      .filter((row) => compareVersions({ left: version, right: row.until }) >= 0)
      .map((row) => `  - ${row.state}: read until ${row.until}, now ${version}`);

    expect(
      overdue,
      `docs/versioning.md, Retired state: remove the read of the old shape in the code, then delete the row.\n${overdue.join('\n')}`,
    ).toEqual([]);
  });
});
