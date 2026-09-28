import { describe, expect, it } from 'vitest';
import { historyBackupRef, historyBackupTimeMs } from './historyBackupRef';

describe('history backup refs', () => {
  it('encodes the full branch name the way the engine does', () => {
    expect(historyBackupRef({ branch: 'feature/a', atMs: 1_790_000_000_000 })).toBe(
      'refs/goodboy/backup/b-666561747572652f61/1790000000000000000',
    );
  });

  it('reads the time back from the stamp and refuses anything else', () => {
    const ref = historyBackupRef({ branch: 'hl/ledger-export', atMs: 1_790_000_123_456 });
    expect(historyBackupTimeMs({ ref })).toBe(1_790_000_123_456);
    expect(historyBackupTimeMs({ ref: 'refs/goodboy/backup/b-66/not-a-stamp' })).toBeNull();
  });
});
