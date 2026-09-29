import { describe, expect, it } from 'vitest';
import type { Session, SessionId, SessionStage, WorkspaceId } from '@goodboy/types';
import type { SessionGithubState } from './types';
import { sortAndGroupSessions } from './slices/session-view';

const WS = 'ws-1' as WorkspaceId;
const SESSION_COUNT = 2000;
const BUDGET_MS = 3000;

const sid = (n: number): SessionId => `session-${n}` as SessionId;

type SessionParams = {
  readonly index: number;
};

const makeSession = ({ index }: SessionParams): Session => {
  const day = String((index % 30) + 1).padStart(2, '0');
  return {
    id: sid(index),
    workspaceId: WS,
    goal: `Goal ${Math.random().toString(36).slice(2)}`,
    state: { kind: 'idle', lastActivityAt: '2024-01-01T00:00:00.000Z' as Session['createdAt'] },
    contextSlots: [],
    providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: false },
    permissionMode: 'bypassPermissions',
    workflowRuns: [],
    autoRun: false,
    titleUserEdited: false,
    createdAt: `2024-01-${day}T00:00:00.000Z` as Session['createdAt'],
    updatedAt: `2024-01-${day}T0${index % 10}:00:00.000Z` as Session['updatedAt'],
  };
};

type PrParams = {
  readonly isDraft: boolean;
  readonly isApproved: boolean;
};

const makePr = ({ isDraft, isApproved }: PrParams): NonNullable<SessionGithubState['pr']> => ({
  number: 1,
  title: 'test pr',
  url: 'https://github.com/x/y/pull/1',
  state: 'open',
  mergeable: null,
  checks: null,
  baseBranch: 'main',
  headBranch: 'feat/x',
  isDraft,
  reviewDecision: isApproved ? 'approved' : null,
  body: '',
  updatedAt: '2024-01-01T00:00:00.000Z',
});

type GithubParams = {
  readonly id: SessionId;
  readonly pr: SessionGithubState['pr'];
};

const githubState = ({ pr }: GithubParams): SessionGithubState => ({
  pr,
  linkedIssues: [],
  fetchedAt: null,
  failedAt: null,
  loading: false,
  error: null,
  detail: null,
  detailFetchedAt: null,
  detailLoading: false,
  detailError: null,
});

const STAGES = ['attention', 'running', 'review', 'building', 'done'] as const;

describe('sortAndGroupSessions, performance', () => {
  it(`handles ${SESSION_COUNT} sessions in under ${BUDGET_MS}ms`, () => {
    const sessions = Array.from({ length: SESSION_COUNT }, (_, index) => makeSession({ index }));
    const stages: Record<SessionId, SessionStage> = {};
    const github: Record<SessionId, SessionGithubState> = {};
    sessions.forEach((session, index) => {
      stages[session.id] = STAGES[index % 5]!;
      github[session.id] = githubState({
        id: session.id,
        pr:
          index % 5 === 0
            ? null
            : makePr({ isDraft: index % 3 === 0, isApproved: index % 7 === 0 }),
      });
    });

    const start = performance.now();
    for (const sort of ['updatedAt', 'goal', 'createdAt'] as const) {
      for (const group of ['none', 'stage', 'pr'] as const) {
        sortAndGroupSessions(sessions, { sort, group }, github, stages);
      }
    }
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(BUDGET_MS);
  });
});
