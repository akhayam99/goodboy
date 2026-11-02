// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../../../store/storyHarness')).dbModuleMock());
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import type { PullRequestState, Session, SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { renderBar, runningState, seedColumn, sessionOf } from '../../testing/sessionColumn';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
});

afterEach(cleanup);

type PrParams = {
  readonly number: number;
};

const mergedPr = ({ number }: PrParams): PullRequestState => ({
  number,
  title: `Pull request ${number}`,
  url: `https://github.com/harborline/payments-api/pull/${number}`,
  state: 'merged',
  mergeable: null,
  checks: 'success',
  baseBranch: 'main',
  headBranch: `goodboy/pr-${number}`,
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2026-10-04T09:00:00.000Z',
});

const githubOf = ({ number }: PrParams) => ({
  pr: mergedPr({ number }),
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

const titles = (): ReadonlyArray<string> =>
  screen
    .queryAllByRole('option')
    .filter((button) => button.hasAttribute('data-select-id'))
    .map((button) => button.firstElementChild?.textContent ?? '');

const doneHeader = (): HTMLElement => screen.getByRole('button', { name: /^Done/ });

const running = sessionOf({ goal: 'Move the ledger export to a queue', state: runningState() });
const idle = sessionOf({ goal: 'Backfill the settlement dates' });
const paginated = sessionOf({ goal: 'Paginate the payments list' });
const digest = sessionOf({ goal: 'Write the notify-relay digest' });
const ALL: ReadonlyArray<Session> = [running, idle, paginated, digest];

const seed = ({ currentSessionId = null }: { readonly currentSessionId?: SessionId | null }) => {
  seedColumn({ store: useAppStore, sessions: ALL, currentSessionId });
  useAppStore.setState({
    sessionGithub: {
      [paginated.id]: githubOf({ number: 304 }),
      [digest.id]: githubOf({ number: 305 }),
    },
  });
};

describe('the Done group of the session list', () => {
  it('closes the list with Done 2, shut, and keeps every other session above it', () => {
    seed({});
    renderBar();

    expect(doneHeader().getAttribute('aria-expanded')).toBe('false');
    expect(doneHeader().textContent).toContain('2');
    expect(titles()).toEqual([running.goal, idle.goal]);
  });

  it('opens on a click and lists its sessions after the rest, then shuts again', () => {
    seed({});
    renderBar();

    fireEvent.click(doneHeader());
    expect(doneHeader().getAttribute('aria-expanded')).toBe('true');
    expect(titles().slice(0, 2)).toEqual([running.goal, idle.goal]);
    expect(titles().slice(2).sort()).toEqual([digest.goal, paginated.goal].sort());

    fireEvent.click(doneHeader());
    expect(titles()).toEqual([running.goal, idle.goal]);
  });

  it('keeps the open session in place, even when it is done', () => {
    seed({ currentSessionId: paginated.id });
    renderBar();

    expect(titles()).toContain(paginated.goal);
    expect(titles()).not.toContain(digest.goal);
  });

  it('brings a session back up the moment it is not done any more, and drops the group when none is left', () => {
    seed({});
    renderBar();

    act(() => {
      useAppStore.setState({
        sessionGithub: {
          [paginated.id]: githubOf({ number: 304 }),
          [digest.id]: { ...githubOf({ number: 305 }), pr: null },
        },
      });
    });
    expect(titles()).toContain(digest.goal);
    expect(doneHeader().textContent).not.toContain('2');

    act(() => {
      useAppStore.setState({
        sessionGithub: {
          [paginated.id]: { ...githubOf({ number: 304 }), pr: null },
          [digest.id]: { ...githubOf({ number: 305 }), pr: null },
        },
      });
    });
    expect(screen.queryByRole('button', { name: /^Done/ })).toBeNull();
  });
});
