import { describe, expect, it } from 'vitest';
import { branchNextStepOf } from '../../branchNextStepOf';
import { branchStartCellsOf } from './branchStartCellsOf';

const NOW = 1_790_000_000_000;
const TWELVE_MINUTES = 12 * 60_000;

const PUSHED = branchNextStepOf({
  status: {
    mainDistance: { kind: 'known', ahead: 3, behind: 0 },
    upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
    inProgress: null,
  },
  hasConflictStop: false,
});

const CONFLICT = branchNextStepOf({
  status: {
    mainDistance: { kind: 'known', ahead: 3, behind: 7 },
    upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
    inProgress: 'rebase',
  },
  hasConflictStop: false,
});

describe('branchStartCellsOf', () => {
  it('keeps Local checks, Pull request, Remote and Branch in that order', () => {
    expect(
      branchStartCellsOf({
        step: PUSHED,
        baseBranch: 'main',
        conflictCount: 0,
        localCheck: null,
        now: NOW,
      }).map((cell) => `${cell.label}: ${cell.word}`),
    ).toEqual([
      'Local checks: Not run',
      'Pull request: None yet',
      'Remote: Pushed',
      'Branch: Up to date',
    ]);
  });

  it('says the last pre-push hook passed, and when', () => {
    const [local] = branchStartCellsOf({
      step: PUSHED,
      baseBranch: 'main',
      conflictCount: 0,
      localCheck: { outcome: 'passed', at: NOW - TWELVE_MINUTES, message: null },
      now: NOW,
    });

    expect(local).toMatchObject({ word: 'Passed', tone: 'success' });
    expect(local?.detail).toBe('pre-push hook, 12m ago');
  });

  it('says the hook declined the last push in danger', () => {
    const [local] = branchStartCellsOf({
      step: PUSHED,
      baseBranch: 'main',
      conflictCount: 0,
      localCheck: { outcome: 'declined', at: NOW, message: 'pre-push hook declined' },
      now: NOW,
    });

    expect(local).toMatchObject({ word: 'Declined', tone: 'danger' });
  });

  it('draws the conflicts of a stopped rebase amber, with the count of files', () => {
    const branch = branchStartCellsOf({
      step: CONFLICT,
      baseBranch: 'main',
      conflictCount: 2,
      localCheck: null,
      now: NOW,
    })[3];

    expect(branch).toMatchObject({
      word: 'Conflicts',
      detail: '2 files, onto main',
      tone: 'warning',
    });
  });

  it('never reads Pushed for a diverged branch and counts both sides in warning', () => {
    const diverged = branchNextStepOf({
      status: {
        mainDistance: { kind: 'known', ahead: 3, behind: 0 },
        upstreamDistance: { kind: 'known', ahead: 2, behind: 1 },
        inProgress: null,
      },
      hasConflictStop: false,
    });

    const remote = branchStartCellsOf({
      step: diverged,
      baseBranch: 'main',
      conflictCount: 0,
      localCheck: null,
      now: NOW,
    }).find((cell) => cell.id === 'remote');

    expect(remote).toMatchObject({
      word: 'Diverged',
      detail: '2 yours and 1 online',
      tone: 'warning',
    });
  });
});
