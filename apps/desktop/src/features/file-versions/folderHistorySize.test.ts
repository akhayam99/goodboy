import { describe, expect, it } from 'vitest';
import { folderHistorySize } from './folderHistorySize';

const MB = 1024 * 1024;

const sizeOf = ({
  versionBytes,
  capBytes,
}: {
  readonly versionBytes: number;
  readonly capBytes: number;
}) => ({
  folderPath: '/Users/dana/Documents/acme-notes',
  isReady: true,
  fileCount: 86,
  keptBytes: 42 * MB,
  versionBytes,
  versionCount: 12,
  capBytes,
});

describe('folderHistorySize', () => {
  it('reads the saved versions against the folder cap', () => {
    expect(
      folderHistorySize({ size: sizeOf({ versionBytes: 18 * MB, capBytes: 1024 * MB }) }),
    ).toEqual({
      usedBytes: 18 * MB,
      capBytes: 1024 * MB,
      usedShare: 18 / 1024,
      versionCount: 12,
    });
  });

  it('never reads over a full meter', () => {
    expect(folderHistorySize({ size: sizeOf({ versionBytes: 30, capBytes: 10 }) }).usedShare).toBe(
      1,
    );
  });
});
