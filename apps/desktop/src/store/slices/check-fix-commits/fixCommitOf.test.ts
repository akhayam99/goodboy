import { describe, expect, it } from 'vitest';
import type { BranchCommit } from '@goodboy/types';
import { fixCommitOf } from './fixCommitOf';

const STARTED_AT = '2026-10-10T09:40:00.000Z';
const START_SECONDS = Date.parse(STARTED_AT) / 1_000;

type CommitParams = {
  readonly shortSha: string;
  readonly offset: number;
  readonly isPushed?: boolean;
};

const commit = ({ shortSha, offset, isPushed = false }: CommitParams): BranchCommit => ({
  sha: `${shortSha}0000000000000000000000000000000`,
  shortSha,
  subject: `Subject ${shortSha}`,
  author: 'Acme Dev',
  timestamp: START_SECONDS + offset,
  pushed: isPushed,
  parentSha: null,
});

describe('fixCommitOf', () => {
  it('finds nothing when every commit predates the fix', () => {
    const commits = [commit({ shortSha: 'aaaaaaa', offset: -5, isPushed: true })];
    expect(fixCommitOf({ commits, startedAt: STARTED_AT })).toEqual({ kind: 'none' });
  });
  it('takes the newest commit made after the fix started and counts the unpushed ones', () => {
    const commits = [
      commit({ shortSha: 'ccccccc', offset: 90 }),
      commit({ shortSha: 'bbbbbbb', offset: 30 }),
      commit({ shortSha: 'aaaaaaa', offset: -600, isPushed: true }),
    ];
    expect(fixCommitOf({ commits, startedAt: STARTED_AT })).toEqual({
      kind: 'found',
      sha: 'ccccccc',
      subject: 'Subject ccccccc',
      count: 2,
      unpushed: 2,
    });
  });
  it('counts a commit made in the second the fix started', () => {
    const commits = [commit({ shortSha: 'ddddddd', offset: 0 })];
    expect(fixCommitOf({ commits, startedAt: STARTED_AT })).toMatchObject({ kind: 'found' });
  });
  it('reports zero unpushed once the commit is on the remote', () => {
    const commits = [commit({ shortSha: 'eeeeeee', offset: 10, isPushed: true })];
    expect(fixCommitOf({ commits, startedAt: STARTED_AT })).toMatchObject({
      kind: 'found',
      count: 1,
      unpushed: 0,
    });
  });
  it('is unreadable when the start time is not a date', () => {
    expect(fixCommitOf({ commits: [], startedAt: 'not a date' })).toEqual({ kind: 'unreadable' });
  });
});
