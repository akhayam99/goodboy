import { describe, expect, it } from 'vitest';
import type { StorageStats } from '../../store/slices/storage/types';
import type { StorageSummary } from '../../store/slices/storage/summarizeStorage';
import { storageTotalBytes } from './storageTotalBytes';

const STATS: StorageStats = {
  databaseBytes: 100,
  archivedSessionCount: 2,
  archivedTranscriptRows: 4,
  archivedTranscriptBytes: 40,
  snapshotBytes: 10,
  snapshotCount: 1,
  savedVersionsBytes: 5,
  appDataFolder: null,
  diskFreeBytes: null,
  checkedAt: 0,
};

const tally = (bytes: number) => ({ count: 1, bytes });

const SUMMARY: StorageSummary = {
  inUse: tally(1),
  canGo: tally(2),
  reviewFirst: tally(4),
  kept: tally(8),
  review: tally(6),
  unowned: 0,
  localCommitFolders: 0,
};

describe('storageTotalBytes', () => {
  it('adds folders, app data, transcripts and artifacts for every workspace', () => {
    expect(
      storageTotalBytes({
        stats: STATS,
        artifacts: [{ sizeBytes: 1000 }, { sizeBytes: null }],
        summary: SUMMARY,
        isScoped: false,
      }),
    ).toBe(1 + 2 + 4 + 8 + 115 + 40 + 1000);
  });

  it('leaves shared app data out of a scoped total', () => {
    expect(
      storageTotalBytes({ stats: STATS, artifacts: [], summary: SUMMARY, isScoped: true }),
    ).toBe(1 + 2 + 4 + 8 + 40);
  });
});
