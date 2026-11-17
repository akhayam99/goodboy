// @vitest-environment node
import { describe, expect, it } from 'vitest';
import type { FileDiff } from '@goodboy/types';
import { isOffTargetFix } from './isOffTargetFix';

type FileParams = {
  readonly path: string;
  readonly start: number;
};

const fileAt = ({ path, start }: FileParams): FileDiff => ({
  path,
  status: 'modified',
  additions: 1,
  deletions: 0,
  binary: false,
  hunks: [
    {
      header: `@@ -${start},1 +${start},2 @@`,
      oldStart: start,
      oldLines: 1,
      newStart: start,
      newLines: 2,
      lines: [
        { kind: 'context', oldLine: start, newLine: start, text: 'const header = () => null;' },
        { kind: 'add', oldLine: null, newLine: start + 1, text: 'export const layout = header;' },
      ],
    },
  ],
});

const COMMENTED = 'features/branch/components/ThreadProperties.tsx';

describe('isOffTargetFix', () => {
  it('flags a fix that never touches the commented file', () => {
    const files = [fileAt({ path: 'e2e/ledger-core.spec.ts', start: 4 })];

    expect(isOffTargetFix({ files, path: COMMENTED, line: 30 })).toBe(true);
  });

  it('flags a fix far from the commented line', () => {
    const files = [fileAt({ path: COMMENTED, start: 400 })];

    expect(isOffTargetFix({ files, path: COMMENTED, line: 30 })).toBe(true);
  });

  it('accepts a fix near the commented line', () => {
    const files = [
      fileAt({ path: 'e2e/ledger-core.spec.ts', start: 4 }),
      fileAt({ path: COMMENTED, start: 50 }),
    ];

    expect(isOffTargetFix({ files, path: COMMENTED, line: 30 })).toBe(false);
  });

  it('stays quiet without a commented file or without a change', () => {
    expect(isOffTargetFix({ files: [], path: COMMENTED, line: 30 })).toBe(false);
    expect(
      isOffTargetFix({ files: [fileAt({ path: 'a.ts', start: 1 })], path: null, line: null }),
    ).toBe(false);
  });
});
