import { describe, expect, it } from 'vitest';
import type { IsoDateTime, PullRequestState, SessionExternalTask, SessionId } from '@goodboy/types';
import { buildWorkItems } from './workItems';

const SESSION_ID = 'session-1' as SessionId;
const DATE = '2026-07-22T10:00:00.000Z' as IsoDateTime;

type TaskParams = {
  readonly overrides?: Partial<SessionExternalTask>;
};

const makeTask = ({ overrides = {} }: TaskParams): SessionExternalTask => ({
  sessionId: SESSION_ID,
  provider: 'linear',
  externalId: 'GB-1',
  identifier: 'GB-1',
  url: 'https://linear.app/goodboy/issue/GB-1',
  title: 'Ship the work item',
  createdAt: DATE,
  ...overrides,
});

type PrParams = {
  readonly overrides?: Partial<PullRequestState>;
};

const makePr = ({ overrides = {} }: PrParams): PullRequestState => ({
  number: 42,
  title: 'Ship the work item',
  url: 'https://github.com/acme/goodboy/pull/42',
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'ak/current',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: DATE,
  ...overrides,
});

describe('buildWorkItems', () => {
  it('projects an issue on the current branch with the pull requests of that branch', () => {
    const task = makeTask({ overrides: { branch: 'ak/current' } });

    const { current, history } = buildWorkItems({
      tasks: [task],
      currentBranch: 'ak/current',
      branchPrs: [makePr({})],
    });

    expect(history).toEqual([]);
    expect(current).toHaveLength(1);
    expect(current[0]?.branch).toBe('ak/current');
    expect(current[0]?.prs.map((pr) => pr.number)).toEqual([42]);
    expect(current[0]?.isCompleted).toBe(false);
  });

  it('moves an issue stamped on another branch to the history with no pull requests', () => {
    const outgoing = makeTask({ overrides: { branch: 'ak/outgoing' } });

    const { current, history } = buildWorkItems({
      tasks: [outgoing],
      currentBranch: 'ak/current',
      branchPrs: [makePr({})],
    });

    expect(current).toEqual([]);
    expect(history).toHaveLength(1);
    expect(history[0]?.isOnCurrentBranch).toBe(false);
    expect(history[0]?.prs).toEqual([]);
  });

  it('reads a merged work item as completed instead of current work', () => {
    const task = makeTask({ overrides: { branch: 'ak/current' } });

    const { current, history } = buildWorkItems({
      tasks: [task],
      currentBranch: 'ak/current',
      branchPrs: [makePr({ overrides: { state: 'merged' } })],
    });

    expect(current).toEqual([]);
    expect(history[0]?.isCompleted).toBe(true);
  });

  it('keeps an unstamped link on the current branch instead of hiding it', () => {
    const { current, history } = buildWorkItems({
      tasks: [makeTask({})],
      currentBranch: 'ak/current',
      branchPrs: [],
    });

    expect(history).toEqual([]);
    expect(current[0]?.branch).toBeNull();
  });
});
