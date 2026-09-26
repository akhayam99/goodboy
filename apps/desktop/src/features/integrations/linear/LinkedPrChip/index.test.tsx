// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PullRequestState } from '@goodboy/types';

type Store = {
  currentSessionId: string | null;
  currentWorkspaceId: string | null;
  sessions: ReadonlyArray<{ id: string; workspaceId: string }>;
  sessionProjectPrs: Record<string, Readonly<Record<string, ReadonlyArray<PullRequestState>>>>;
  sessionGithub: Record<string, { pr: PullRequestState | null }>;
  readonly selectSessionPr: ReturnType<typeof vi.fn>;
  readonly setActiveLens: ReturnType<typeof vi.fn>;
  readonly setCurrentSession: ReturnType<typeof vi.fn>;
  readonly reportError: ReturnType<typeof vi.fn>;
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
    selectSessionPr: vi.fn(async () => undefined),
    setActiveLens: vi.fn(),
    setCurrentSession: vi.fn(async () => undefined),
    reportError: vi.fn(async () => undefined),
  } as Store,
  openUrl: vi.fn(async () => undefined),
}));

vi.mock('../../../../store', () => ({
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
  h.store.setActiveLens.mockClear();
  h.store.setCurrentSession.mockClear();
  h.store.reportError.mockClear();
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
    expect(h.store.setActiveLens).toHaveBeenCalledWith('session-1', 'pr');
    expect(h.store.setCurrentSession).not.toHaveBeenCalled();
    expect(h.openUrl).not.toHaveBeenCalled();
  });

  it('switches to another session of the workspace that holds the pull request', async () => {
    h.store.sessionProjectPrs = { 'session-2': { 'project-1': [SESSION_PR] } };

    render(
      <LinkedPrChip
        pr={{ url: SESSION_PR.url, number: 42, repo: 'acme/goodboy', status: 'open' }}
      />,
    );
    fireEvent.click(screen.getByRole('button'));
    await Promise.resolve();
    await Promise.resolve();

    expect(h.store.setCurrentSession).toHaveBeenCalledWith('session-2');
    expect(h.store.selectSessionPr).toHaveBeenCalledWith('session-2', 42);
    expect(h.store.setActiveLens).toHaveBeenCalledWith('session-2', 'pr');
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
    expect(h.store.setActiveLens).not.toHaveBeenCalled();
    expect(h.store.setCurrentSession).not.toHaveBeenCalled();
  });

  it('opens the pull request inside Goodboy even while a studio overlay is showing', () => {
    h.store.sessionProjectPrs = { 'session-1': { 'project-1': [SESSION_PR] } };
    const overlay = document.createElement('div');
    overlay.setAttribute('data-studio-overlay', '');
    document.body.appendChild(overlay);

    render(
      <LinkedPrChip
        pr={{ url: SESSION_PR.url, number: 42, repo: 'acme/goodboy', status: 'open' }}
      />,
    );
    fireEvent.click(screen.getByRole('button'));

    expect(h.store.selectSessionPr).toHaveBeenCalledWith('session-1', 42);
    expect(h.store.setActiveLens).toHaveBeenCalledWith('session-1', 'pr');
    expect(h.openUrl).not.toHaveBeenCalled();
    overlay.remove();
  });
});
