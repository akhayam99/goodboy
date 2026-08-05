// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PullRequestState } from '@goodboy/types';

type Store = {
  currentSessionId: string | null;
  sessionGithubPrs: Record<string, ReadonlyArray<PullRequestState>>;
  sessionGithub: Record<string, { pr: PullRequestState | null }>;
  readonly selectSessionPr: ReturnType<typeof vi.fn>;
  readonly setActiveLens: ReturnType<typeof vi.fn>;
};

const h = vi.hoisted(() => ({
  store: {
    currentSessionId: 'session-1',
    sessionGithubPrs: {},
    sessionGithub: {},
    selectSessionPr: vi.fn(async () => undefined),
    setActiveLens: vi.fn(),
  } as Store,
  openUrl: vi.fn(async () => undefined),
}));

vi.mock('../../../../store', () => ({
  EMPTY_ARRAY: Object.freeze([]),
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
  h.store.sessionGithubPrs = {};
  h.store.sessionGithub = {};
  h.store.selectSessionPr.mockClear();
  h.store.setActiveLens.mockClear();
  h.openUrl.mockClear();
});

afterEach(cleanup);

describe('LinkedPrChip', () => {
  it('opens the pull request the session already holds in the pull request lens', () => {
    h.store.sessionGithubPrs = { 'session-1': [SESSION_PR] };

    render(
      <LinkedPrChip
        pr={{ url: SESSION_PR.url, number: 42, repo: 'acme/goodboy', status: 'open' }}
      />,
    );
    fireEvent.click(screen.getByRole('button'));

    expect(h.store.selectSessionPr).toHaveBeenCalledWith('session-1', 42);
    expect(h.store.setActiveLens).toHaveBeenCalledWith('session-1', 'pr');
    expect(h.openUrl).not.toHaveBeenCalled();
  });

  it('falls back to the browser for a pull request this session does not track', () => {
    h.store.sessionGithubPrs = { 'session-1': [SESSION_PR] };

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
  });
});
