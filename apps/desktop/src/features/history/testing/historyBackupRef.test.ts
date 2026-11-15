// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { historyBackupRef } from './historyBackupRef';

describe('history backup refs', () => {
  it('encodes the full branch name the way the engine does', () => {
    expect(historyBackupRef({ branch: 'feature/a', atMs: 1_790_000_000_000 })).toBe(
      'refs/goodboy/backup/b-666561747572652f61/1790000000000000000',
    );
  });
});
