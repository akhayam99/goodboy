// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { worktreeStatusOf } from '../../../../test/worktreeStatusOf';
import { aMountRow } from '../../../../features/session/central/branches/testing/aMountRow';
import { worktreeRowStateFor } from './worktreeRowStateFor';

const MERGED = { isFinished: true } as const;

describe('worktreeRowStateFor', () => {
  it('warns a live branch that is behind main', () => {
    const state = worktreeRowStateFor({
      row: aMountRow({ key: 'a', projectName: 'ledger-core', branch: 'ak/feat-rates' }),
      status: worktreeStatusOf({ behind: 84 }),
      commentsWaiting: 0,
    });

    expect(state).toEqual({ tone: 'warning', reason: '84 behind main' });
  });

  it('draws no dot and no reason on a finished branch, however far behind', () => {
    const state = worktreeRowStateFor({
      row: {
        ...aMountRow({ key: 'a', projectName: 'ledger-core', branch: 'ak/feat-rates' }),
        ...MERGED,
      },
      status: worktreeStatusOf({ behind: 84 }),
      commentsWaiting: 0,
    });

    expect(state).toEqual({ tone: null, reason: null });
  });

  it('ignores a rebase and conflicts left from before the merge', () => {
    const state = worktreeRowStateFor({
      row: {
        ...aMountRow({ key: 'a', projectName: 'ledger-core', branch: 'ak/feat-rates' }),
        ...MERGED,
      },
      status: worktreeStatusOf({ behind: 63, unmerged: 2, inProgress: 'rebase' }),
      commentsWaiting: 0,
    });

    expect(state).toEqual({ tone: null, reason: null });
  });
});
