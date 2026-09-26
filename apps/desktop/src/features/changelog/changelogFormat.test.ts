import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { lintRelease } from './lintRelease';
import type { ChangelogLine } from './lintRelease';

const CHANGELOG_PATH = join(__dirname, '..', '..', '..', '..', '..', 'CHANGELOG.md');
const MIN_VERSION: readonly [number, number, number] = [0, 5, 0];
const VERSION_HEADING_PATTERN = /^## Goodboy v(\d+)\.(\d+)\.(\d+)$/;

type Version = readonly [number, number, number];

type ReleaseBlock = {
  readonly version: string;
  readonly lines: ReadonlyArray<ChangelogLine>;
};

const isAtLeastMinVersion = ({ version }: { readonly version: Version }): boolean => {
  const [major, minor, patch] = version;
  const [minMajor, minMinor, minPatch] = MIN_VERSION;
  if (major !== minMajor) {
    return major > minMajor;
  }
  if (minor !== minMinor) {
    return minor > minMinor;
  }
  return patch >= minPatch;
};

const parseVersion = ({ text }: { readonly text: string }): Version => {
  const parts = text.split('.').map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
};

const splitReleases = ({ content }: { readonly content: string }): ReadonlyArray<ReleaseBlock> => {
  const rawLines = content.split('\n');
  const blocks: ReleaseBlock[] = [];
  let current: { version: string; lines: ChangelogLine[] } | null = null;
  rawLines.forEach((text, index) => {
    const match = VERSION_HEADING_PATTERN.exec(text);
    if (match !== null) {
      if (current !== null) {
        blocks.push(current);
      }
      current = { version: `${match[1]}.${match[2]}.${match[3]}`, lines: [] };
    }
    if (current !== null) {
      current.lines.push({ number: index + 1, text });
    }
  });
  if (current !== null) {
    blocks.push(current);
  }
  return blocks;
};

const describeViolations = ({
  version,
  violations,
}: {
  readonly version: string;
  readonly violations: ReturnType<typeof lintRelease>;
}): string => {
  const details = violations
    .map((violation) => `line ${violation.line} [${violation.rule}]: ${violation.message}`)
    .join('\n');
  return `${violations.length} violation(s) in Goodboy v${version}:\n${details}`;
};

describe('CHANGELOG.md format', () => {
  const content = readFileSync(CHANGELOG_PATH, 'utf8');
  const releases = splitReleases({ content });
  const checkedReleases = releases.filter((release) =>
    isAtLeastMinVersion({ version: parseVersion({ text: release.version }) }),
  );

  it('has at least one release from v0.5.0 on to check', () => {
    expect(checkedReleases.length).toBeGreaterThan(0);
  });

  checkedReleases.forEach((release) => {
    it(`Goodboy v${release.version} follows the changelog format`, () => {
      const violations = lintRelease({ lines: release.lines });
      expect(violations, describeViolations({ version: release.version, violations })).toEqual([]);
    });
  });
});
