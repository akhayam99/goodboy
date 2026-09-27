import { describe, expect, it } from 'vitest';
import type { SessionId } from '@goodboy/types';
import type { ProjectBranch } from '../../worktree/branchCleanup';
import { classifyBranch, matchesBranchFilter, matchesBranchTab } from './classifyBranch';

const NOW = Date.parse('2026-09-27T10:00:00.000Z');
const DAY_S = 24 * 60 * 60;
const nowS = NOW / 1000;

const branch = (patch: Partial<ProjectBranch>): ProjectBranch => ({
  name: 'goodboy/ledger-close',
  sha: 'abc',
  authorEmail: 'dev@harborline.test',
  lastCommitAt: nowS - DAY_S,
  location: 'on-origin',
  mergeState: { kind: 'merged-via-squash' },
  behind: null,
  ...patch,
});

const sessions = new Map<string, SessionId | null>([
  ['goodboy/ledger-close', 'session-close' as SessionId],
  ['goodboy/ledger-scratch', null],
]);

const classify = (patch: Partial<ProjectBranch>) =>
  classifyBranch({
    branch: branch(patch),
    goodboySessions: sessions,
    userEmail: 'dev@harborline.test',
    now: NOW,
  });

describe('classifyBranch', () => {
  it('calls a merged branch safe and points at its session', () => {
    const entry = classify({});

    expect(entry.verdict).toBe('safe-merged');
    expect(entry.owner).toEqual({ kind: 'session', sessionId: 'session-close' });
  });

  it('calls a branch that never had commits safe with no commits', () => {
    const entry = classify({
      name: 'goodboy/ledger-scratch',
      mergeState: { kind: 'no-own-commits' },
    });

    expect(entry.verdict).toBe('safe-no-commits');
    expect(entry.owner).toEqual({ kind: 'no-session' });
  });

  it('flags gone-on-origin work, stale local branches and very old ones for a look', () => {
    expect(
      classify({ location: 'gone-on-origin', mergeState: { kind: 'not-merged', ahead: 2 } })
        .verdict,
    ).toBe('needs-look');
    expect(
      classify({
        location: 'local-only',
        lastCommitAt: nowS - 40 * DAY_S,
        mergeState: { kind: 'not-merged', ahead: 3 },
      }).verdict,
    ).toBe('needs-look');
    expect(
      classify({ lastCommitAt: nowS - 100 * DAY_S, mergeState: { kind: 'not-merged', ahead: 1 } })
        .verdict,
    ).toBe('needs-look');
    expect(classify({ mergeState: { kind: 'not-merged', ahead: 1 } }).verdict).toBe('kept');
  });

  it('marks branches by your git email as yours when Goodboy did not make them', () => {
    const entry = classify({
      name: 'spike/ledger-v2',
      mergeState: { kind: 'not-merged', ahead: 3 },
    });

    expect(entry.owner).toEqual({ kind: 'by-you' });
    expect(entry.isYours).toBe(true);
    expect(entry.isMadeByGoodboy).toBe(false);
  });
});

describe('filters and tabs', () => {
  it('keeps protected branches out of every filter', () => {
    const entry = classify({ name: 'main', mergeState: { kind: 'protected' } });

    expect(matchesBranchFilter({ entry, filter: 'all' })).toBe(false);
  });

  it('narrows Made by Goodboy, Yours and All local', () => {
    const mine = classify({
      name: 'spike/ledger-v2',
      mergeState: { kind: 'not-merged', ahead: 3 },
    });
    const other = classifyBranch({
      branch: branch({ name: 'old/checkout-ab-test', authorEmail: 'someone@acme.test' }),
      goodboySessions: sessions,
      userEmail: 'dev@harborline.test',
      now: NOW,
    });

    expect(matchesBranchFilter({ entry: mine, filter: 'goodboy' })).toBe(false);
    expect(matchesBranchFilter({ entry: mine, filter: 'yours' })).toBe(true);
    expect(matchesBranchFilter({ entry: other, filter: 'yours' })).toBe(false);
    expect(matchesBranchFilter({ entry: other, filter: 'all' })).toBe(true);
  });

  it('splits Safe to delete from Needs a look', () => {
    expect(matchesBranchTab({ entry: classify({}), tab: 'safe' })).toBe(true);
    expect(matchesBranchTab({ entry: classify({}), tab: 'needs-look' })).toBe(false);
  });
});
