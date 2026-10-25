import { afterEach, describe, expect, it } from 'vitest';
import {
  readMockArtifactProvenance,
  readMockMountDiffStat,
  registerMockFixtures,
} from './mockFixtures';

describe('mock fixtures', () => {
  afterEach(() => {
    registerMockFixtures({
      readers: { mountDiffStat: () => null, artifactProvenance: () => null },
    });
  });

  it('reads nothing until a scene registers its fixtures', () => {
    expect(readMockMountDiffStat({ worktreePath: '/mock/harborline/ledger-core' })).toBeNull();
    expect(readMockArtifactProvenance({ agentId: 'agent-ledger' })).toBeNull();
  });

  it('reads what the registered readers answer', () => {
    registerMockFixtures({
      readers: {
        mountDiffStat: ({ worktreePath }) =>
          worktreePath === '/mock/harborline/ledger-core' ? { additions: 3, deletions: 1 } : null,
        artifactProvenance: () => null,
      },
    });

    expect(readMockMountDiffStat({ worktreePath: '/mock/harborline/ledger-core' })).toEqual({
      additions: 3,
      deletions: 1,
    });
    expect(readMockMountDiffStat({ worktreePath: '/mock/harborline/other' })).toBeNull();
  });
});
