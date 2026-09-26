import { describe, expect, it } from 'vitest';
import type { PullRequestState, Session, SessionId, WorkspaceId } from '@goodboy/types';
import { selectSessionForPr } from './selectSessionForPr';

const buildPr = (overrides: Partial<PullRequestState>): PullRequestState => ({
  number: 1,
  title: 'A change',
  url: 'https://github.com/acme/goodboy/pull/1',
  state: 'open',
  mergeable: null,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'ak/change',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2026-07-22T12:00:00.000Z',
  ...overrides,
});

const buildSession = (id: string, workspaceId: string): Session =>
  ({ id, workspaceId }) as unknown as Session;

const WORKSPACE_ID = 'workspace-1' as WorkspaceId;

describe('selectSessionForPr', () => {
  it('matches the canonical pull request a session holds', () => {
    const state = {
      sessions: [buildSession('session-1', WORKSPACE_ID)],
      sessionGithub: { 'session-1': { pr: buildPr({ number: 42 }) } },
      sessionProjectPrs: {},
    };

    const match = selectSessionForPr({
      state,
      workspaceId: WORKSPACE_ID,
      url: 'https://github.com/acme/goodboy/pull/1',
    });

    expect(match).toEqual({ sessionId: 'session-1' as SessionId, number: 42 });
  });

  it('matches a pull request tracked on any project mount of a session', () => {
    const state = {
      sessions: [buildSession('session-1', WORKSPACE_ID)],
      sessionGithub: {},
      sessionProjectPrs: {
        'session-1': {
          'project-1': [buildPr({ number: 7, url: 'https://github.com/acme/goodboy/pull/7' })],
        },
      },
    };

    const match = selectSessionForPr({
      state,
      workspaceId: WORKSPACE_ID,
      url: 'https://github.com/acme/goodboy/pull/7',
    });

    expect(match).toEqual({ sessionId: 'session-1' as SessionId, number: 7 });
  });

  it('finds a session other than the one asked first, as long as it is in the workspace', () => {
    const state = {
      sessions: [buildSession('session-1', WORKSPACE_ID), buildSession('session-2', WORKSPACE_ID)],
      sessionGithub: {
        'session-2': { pr: buildPr({ number: 9, url: 'https://github.com/acme/goodboy/pull/9' }) },
      },
      sessionProjectPrs: {},
    };

    const match = selectSessionForPr({
      state,
      workspaceId: WORKSPACE_ID,
      url: 'https://github.com/acme/goodboy/pull/9',
    });

    expect(match).toEqual({ sessionId: 'session-2' as SessionId, number: 9 });
  });

  it('ignores a session outside the given workspace', () => {
    const state = {
      sessions: [buildSession('session-1', 'workspace-2')],
      sessionGithub: { 'session-1': { pr: buildPr({ number: 9 }) } },
      sessionProjectPrs: {},
    };

    const match = selectSessionForPr({
      state,
      workspaceId: WORKSPACE_ID,
      url: 'https://github.com/acme/goodboy/pull/1',
    });

    expect(match).toBeNull();
  });

  it('returns null when no session in the workspace tracks the pull request', () => {
    const state = {
      sessions: [buildSession('session-1', WORKSPACE_ID)],
      sessionGithub: {},
      sessionProjectPrs: {},
    };

    const match = selectSessionForPr({
      state,
      workspaceId: WORKSPACE_ID,
      url: 'https://github.com/acme/goodboy/pull/404',
    });

    expect(match).toBeNull();
  });
});
