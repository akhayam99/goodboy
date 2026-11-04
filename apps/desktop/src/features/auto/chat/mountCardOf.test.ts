// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { mountCardOf } from './mountCardOf';

describe('mountCardOf', () => {
  it('names the need, the branch the user wrote and the one button', () => {
    expect(
      mountCardOf({ project: 'payments-api', branch: 'ak/feat-new-explore', baseBranch: null }),
    ).toEqual({
      title: 'To do this, mount payments-api',
      line: 'A worktree on ak/feat-new-explore is created from main.',
      label: 'Mount payments-api',
      busyLabel: 'Mounting payments-api',
      message: 'Mounted payments-api on ak/feat-new-explore. Go on with my request.',
      doneLine: 'Mounted payments-api on ak/feat-new-explore',
    });
  });

  it('says it without a branch, from the base of the project', () => {
    const card = mountCardOf({ project: 'ledger-core', branch: null, baseBranch: 'develop' });

    expect(card.line).toBe('A worktree is created from develop.');
    expect(card.message).toBe('Mounted ledger-core. Go on with my request.');
  });
});
