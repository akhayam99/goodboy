import { describe, expect, it } from 'vitest';
import { historyVersionWhy } from './historyVersionWhy';
import { versionCommitDiff } from './versionCommitDiff';

describe('historyVersionWhy', () => {
  it('names a rebase when the fork point moved', () => {
    expect(
      historyVersionWhy({
        facts: { isSameForkAsNext: false, nextCommitCount: 3, commitCount: 3 },
      }),
    ).toBe('Before a rebase');
  });

  it('names a fold when the next version has fewer commits', () => {
    expect(
      historyVersionWhy({
        facts: { isSameForkAsNext: true, nextCommitCount: 2, commitCount: 3 },
      }),
    ).toBe('Before a fold or drop');
  });

  it('names a split when the next version has more commits', () => {
    expect(
      historyVersionWhy({
        facts: { isSameForkAsNext: true, nextCommitCount: 4, commitCount: 3 },
      }),
    ).toBe('Before a split');
  });

  it('names a reword or edit when only the content changed', () => {
    expect(
      historyVersionWhy({
        facts: { isSameForkAsNext: true, nextCommitCount: 3, commitCount: 3 },
      }),
    ).toBe('Before a reword or edit');
  });
});

describe('versionCommitDiff', () => {
  it('counts the commits now has that the version lacks and the other way round', () => {
    expect(
      versionCommitDiff({
        versionSubjects: ['Add ledger export', 'Fix rounding', 'Wip'],
        nowSubjects: ['Add ledger export', 'Fix rounding in totals', 'Add retries', 'Wip'],
      }),
    ).toEqual({ added: 2, removed: 1 });
  });

  it('keeps multiplicity when two commits share a subject', () => {
    expect(versionCommitDiff({ versionSubjects: ['Fix'], nowSubjects: ['Fix', 'Fix'] })).toEqual({
      added: 1,
      removed: 0,
    });
    expect(
      versionCommitDiff({ versionSubjects: ['Fix', 'Fix', 'Wip'], nowSubjects: ['Fix'] }),
    ).toEqual({
      added: 0,
      removed: 2,
    });
  });
});
