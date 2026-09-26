// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionPlace } from '../../../../store/slices/navigation/place';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PullRequestState, SessionId } from '@goodboy/types';

type Store = {
  currentSessionId: string | null;
  currentWorkspaceId: string | null;
  sessions: ReadonlyArray<{ id: string; workspaceId: string }>;
  sessionProjectPrs: Record<string, Readonly<Record<string, ReadonlyArray<PullRequestState>>>>;
  sessionGithub: Record<string, { pr: PullRequestState | null }>;
  appStudio: { readonly kind: string } | null;
  readonly selectSessionPr: ReturnType<typeof vi.fn>;
  readonly navigate: ReturnType<typeof vi.fn>;
};

const h = vi.hoisted(() => ({
  store: {
    currentSessionId: 'session-1',
    currentWorkspaceId: 'workspace-1',
    sessions: [
      { id: 'session-1', workspaceId: 'workspace-1' },
      { id: 'session-2', workspaceId: 'workspace-1' },
    ],
    sessionProjectPrs: {},
    sessionGithub: {},
    appStudio: null,
    selectSessionPr: vi.fn(async () => undefined),
    navigate: vi.fn(),
  } as Store,
  openUrl: vi.fn(async () => undefined),
}));

vi.mock('../../../../store', async () => ({
  ...(await import('../../../../store/slices/navigation/place')),
  useAppStore: <T,>(selector: (state: Store) => T) => selector(h.store),
}));

vi.mock('../../../../shared/lib/editor', () => ({
  openUrl: h.openUrl,
}));

import { LinkedPrChip } from '.';

const SESSION_PR: PullRequestState = {
  number: 42,
  title: 'Refactor integration storage',
  url: 'https://github.com/acme/goodboy/pull/42',
  state: 'open',
  mergeable: null,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'ak/current',
  isDraft: false,
  reviewDecision: 'approved',
  body: '',
  updatedAt: '2026-07-22T12:00:00.000Z',
};

beforeEach(() => {
  h.store.currentSessionId = 'session-1';
  h.store.currentWorkspaceId = 'workspace-1';
  h.store.sessionProjectPrs = {};
  h.store.sessionGithub = {};
  h.store.selectSessionPr.mockClear();
  h.store.navigate.mockClear();
  h.openUrl.mockClear();
});

afterEach(cleanup);

describe('LinkedPrChip', () => {
  it('opens the pull request the current session already holds in the pull request lens', () => {
    h.store.sessionProjectPrs = { 'session-1': { 'project-1': [SESSION_PR] } };

    render(
      <LinkedPrChip
        pr={{ url: SESSION_PR.url, number: 42, repo: 'acme/goodboy', status: 'open' }}
      />,
    );
    fireEvent.click(screen.getByRole('button'));

    expect(h.store.selectSessionPr).toHaveBeenCalledWith('session-1', 42);
    expect(h.store.navigate).toHaveBeenCalledWith({
      to: sessionPlace({ sessionId: 'session-1' as SessionId, lens: 'pr' }),
    });
    expect(h.openUrl).not.toHaveBeenCalled();
  });

  it('switches to another session of the workspace that holds the pull request', () => {
    h.store.sessionProjectPrs = { 'session-2': { 'project-1': [SESSION_PR] } };

    render(
      <LinkedPrChip
        pr={{ url: SESSION_PR.url, number: 42, repo: 'acme/goodboy', status: 'open' }}
      />,
    );
    fireEvent.click(screen.getByRole('button'));

    expect(h.store.selectSessionPr).toHaveBeenCalledWith('session-2', 42);
    expect(h.store.navigate).toHaveBeenCalledWith({
      to: sessionPlace({ sessionId: 'session-2' as SessionId, lens: 'pr' }),
    });
    expect(h.openUrl).not.toHaveBeenCalled();
  });

  it('opens the browser for a pull request no session in the workspace tracks', () => {
    h.store.sessionProjectPrs = { 'session-1': { 'project-1': [SESSION_PR] } };

    render(
      <LinkedPrChip
        pr={{
          url: 'https://github.com/acme/other/pull/9',
          number: 9,
          repo: 'acme/other',
          status: null,
        }}
      />,
    );
    fireEvent.click(screen.getByRole('button'));

    expect(h.openUrl).toHaveBeenCalledWith('https://github.com/acme/other/pull/9');
    expect(h.store.navigate).not.toHaveBeenCalled();
  });

  it('falls back to the browser while a studio covers the session', () => {
    h.store.sessionProjectPrs = { 'session-1': { 'project-1': [SESSION_PR] } };
    h.store.appStudio = { kind: 'inbox' };

    render(
      <LinkedPrChip
        pr={{ url: SESSION_PR.url, number: 42, repo: 'acme/goodboy', status: 'open' }}
      />,
    );
    fireEvent.click(screen.getByRole('button'));

    expect(h.openUrl).toHaveBeenCalledWith(SESSION_PR.url);
    expect(h.store.navigate).not.toHaveBeenCalled();
    expect(h.store.selectSessionPr).not.toHaveBeenCalled();
    h.store.appStudio = null;
  });
});
