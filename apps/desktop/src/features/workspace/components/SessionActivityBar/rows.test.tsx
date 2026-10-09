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
import type { PullRequestState, SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../store/storyHarness';
import {
  at,
  failedState,
  harborline,
  renderBar,
  runningState,
  seedColumn,
  sessionOf,
} from '../../testing/sessionColumn';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
});

afterEach(cleanup);

const titlesOnScreen = (): ReadonlyArray<string> =>
  screen
    .getAllByRole('button')
    .filter((button) => button.hasAttribute('data-select-id'))
    .map((button) => button.lastElementChild?.textContent ?? '');

const rowOf = (title: string): HTMLElement => screen.getByRole('button', { name: title });

const mergedPr = (): PullRequestState => ({
  number: 304,
  title: 'Paginate the payments list',
  url: 'https://github.com/harborline/payments-api/pull/304',
  state: 'merged',
  mergeable: null,
  checks: 'success',
  baseBranch: 'main',
  headBranch: 'goodboy/pagination',
  isDraft: false,
  reviewDecision: null,
  body: '',
  updatedAt: '2026-10-04T09:00:00.000Z',
});

describe('a session row', () => {
  const running = sessionOf({ goal: 'Fix webhook retries', state: runningState() });
  const failed = sessionOf({ goal: 'Notify relay backoff', state: failedState() });
  const asking = sessionOf({ goal: 'Retry policy for 429s' });
  const done = sessionOf({ goal: 'Payments API pagination' });
  const idle = sessionOf({ goal: 'Webhook signature rotation' });
  const archivedOne = sessionOf({ goal: 'Legacy hook cleanup' });
  const all = [running, failed, asking, done, idle];

  const mount = () => {
    seedColumn({ store: useAppStore, sessions: all, archived: [archivedOne], questions: [asking] });
    useAppStore.setState({
      sessionGithub: {
        [done.id]: {
          pr: mergedPr(),
          linkedIssues: [],
          fetchedAt: null,
          failedAt: null,
          loading: false,
          error: null,
          detail: null,
          detailFetchedAt: null,
          detailLoading: false,
          detailError: null,
        },
      },
    });
    return renderBar();
  };

  it('is one line: the title and nothing else', () => {
    mount();
    for (const session of all) {
      const row = rowOf(session.goal);
      expect(row.children).toHaveLength(2);
      expect(row.lastElementChild?.textContent).toBe(session.goal);
    }
    expect(screen.queryByTestId('session-progress')).toBeNull();
    expect(screen.queryByTestId('session-row-trailing')).toBeNull();
  });

  it('shows one of five state nodes per session', () => {
    mount();
    act(() => {
      useAppStore.getState().setSessionViewPrefs({
        workspaceId: harborline.id,
        patch: { isArchivedShown: true },
      });
    });
    const kind = (title: string) => rowOf(title).getAttribute('data-node-kind');
    expect(kind('Retry policy for 429s')).toBe('needs');
    expect(kind('Notify relay backoff')).toBe('needs');
    expect(kind('Fix webhook retries')).toBe('running');
    expect(kind('Payments API pagination')).toBe('done');
    expect(kind('Webhook signature rotation')).toBe('idle');
    expect(kind('Legacy hook cleanup')).toBe('archived');
  });

  it('names a blank session Untitled session instead of leaving the row empty', () => {
    const blank = sessionOf({ goal: '' });
    seedColumn({ store: useAppStore, sessions: [blank] });
    renderBar();
    expect(rowOf('Untitled session')).toBeDefined();
  });

  it('tells a screen reader the state and reason without drawing them', () => {
    mount();
    const described = rowOf('Retry policy for 429s').getAttribute('aria-describedby') ?? '';
    expect(document.getElementById(described)?.textContent ?? '').toMatch(/needs you/i);
  });

  it('marks the open session through its page and leaves the rest unmarked', () => {
    seedColumn({ store: useAppStore, sessions: all, currentSessionId: idle.id as SessionId });
    renderBar();
    const marked = Array.from(document.querySelectorAll('[aria-current="page"]'));
    expect(marked).toHaveLength(1);
    expect(marked[0]?.textContent).toMatch(/^Overview/);
    expect(rowOf('Fix webhook retries').getAttribute('aria-current')).toBeNull();
  });

  it('marks the session row itself when the open page has no row', () => {
    seedColumn({ store: useAppStore, sessions: all, currentSessionId: idle.id as SessionId });
    useAppStore.setState({ activeLens: { [idle.id]: 'terminal' } });
    renderBar();
    const marked = Array.from(document.querySelectorAll('[aria-current="page"]'));
    expect(marked).toHaveLength(1);
    expect(marked[0]).toBe(rowOf('Webhook signature rotation'));
  });

  it('opens the session on a click', () => {
    const onSelectSession = vi.fn();
    seedColumn({ store: useAppStore, sessions: all });
    renderBar({ onSelectSession });
    fireEvent.click(rowOf('Fix webhook retries'));
    expect(onSelectSession).toHaveBeenCalledWith(running.id);
  });

  it('moves focus down and up the list with the arrow keys', () => {
    seedColumn({ store: useAppStore, sessions: all });
    renderBar();
    const first = screen
      .getAllByRole('button')
      .find((button) => button.hasAttribute('data-select-id'));
    first?.focus();
    fireEvent.keyDown(first as HTMLElement, { key: 'ArrowDown' });
    expect(document.activeElement).not.toBe(first);
    expect(document.activeElement?.hasAttribute('data-select-id')).toBe(true);
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(first);
  });
});

describe('the order of the list', () => {
  it('puts the sessions that need you on top, the oldest wait first', () => {
    const quiet = sessionOf({ goal: 'Quiet one', lastOpenedAt: '2026-10-06T09:00:00.000Z' });
    const waitingLong = sessionOf({ goal: 'Waiting long', updatedAt: '2026-10-01T09:00:00.000Z' });
    const waitingShort = sessionOf({
      goal: 'Waiting short',
      updatedAt: '2026-10-05T09:00:00.000Z',
    });
    seedColumn({
      store: useAppStore,
      sessions: [quiet, waitingShort, waitingLong],
      questions: [waitingShort, waitingLong],
    });
    renderBar();
    expect(titlesOnScreen()).toEqual(['Waiting long', 'Waiting short', 'Quiet one']);
  });

  it('follows the last session you opened for the rest', () => {
    const older = sessionOf({ goal: 'Opened Monday', lastOpenedAt: '2026-10-05T09:00:00.000Z' });
    const newer = sessionOf({ goal: 'Opened today', lastOpenedAt: '2026-10-06T09:00:00.000Z' });
    seedColumn({ store: useAppStore, sessions: [older, newer] });
    renderBar();
    expect(titlesOnScreen()).toEqual(['Opened today', 'Opened Monday']);
  });

  it('floats a session up the moment it is opened and writes the open', () => {
    const first = sessionOf({ goal: 'Opened today', lastOpenedAt: '2026-10-02T09:00:00.000Z' });
    const second = sessionOf({ goal: 'Opened Monday', lastOpenedAt: '2026-10-01T09:00:00.000Z' });
    seedColumn({ store: useAppStore, sessions: [first, second] });
    renderBar();
    expect(titlesOnScreen()).toEqual(['Opened today', 'Opened Monday']);
    act(() => {
      useAppStore.getState().markSessionOpened({ sessionId: second.id as SessionId });
    });
    expect(titlesOnScreen()).toEqual(['Opened Monday', 'Opened today']);
    expect(storySpies.markSessionOpened).toHaveBeenCalledTimes(1);
  });

  it('does not move a running session while its agent writes', () => {
    const running = sessionOf({
      goal: 'Fix webhook retries',
      state: runningState(),
      lastOpenedAt: '2026-10-05T09:00:00.000Z',
    });
    const other = sessionOf({ goal: 'Other work', lastOpenedAt: '2026-10-06T09:00:00.000Z' });
    seedColumn({ store: useAppStore, sessions: [running, other] });
    renderBar();
    expect(titlesOnScreen()).toEqual(['Other work', 'Fix webhook retries']);
    act(() => {
      useAppStore.setState({
        sessions: [{ ...running, updatedAt: at('2026-10-06T12:00:00.000Z') }, other],
      });
    });
    expect(titlesOnScreen()).toEqual(['Other work', 'Fix webhook retries']);
  });

  it('moves a session to the top the moment it starts needing you', () => {
    const first = sessionOf({ goal: 'First', lastOpenedAt: '2026-10-06T09:00:00.000Z' });
    const second = sessionOf({ goal: 'Second', lastOpenedAt: '2026-10-05T09:00:00.000Z' });
    seedColumn({ store: useAppStore, sessions: [first, second] });
    renderBar();
    expect(titlesOnScreen()).toEqual(['First', 'Second']);
    act(() => {
      seedColumn({ store: useAppStore, sessions: [first, second], questions: [second] });
    });
    expect(titlesOnScreen()).toEqual(['Second', 'First']);
  });
});

describe('the fold', () => {
  const twelve = Array.from({ length: 12 }, (_, index) =>
    sessionOf({
      goal: `Session ${String(index + 1).padStart(2, '0')}`,
      lastOpenedAt: `2026-10-06T${String(20 - index).padStart(2, '0')}:00:00.000Z`,
    }),
  );

  it('shows the first eight rows and counts the rest', () => {
    seedColumn({ store: useAppStore, sessions: twelve });
    renderBar();
    expect(titlesOnScreen()).toHaveLength(8);
    expect(screen.getByRole('button', { name: 'Show 4 more' })).toBeDefined();
  });

  it('expands in place and folds back', () => {
    seedColumn({ store: useAppStore, sessions: twelve });
    renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Show 4 more' }));
    expect(titlesOnScreen()).toHaveLength(12);
    fireEvent.click(screen.getByRole('button', { name: 'Show fewer' }));
    expect(titlesOnScreen()).toHaveLength(8);
  });

  it('remembers the open fold per workspace', () => {
    seedColumn({ store: useAppStore, sessions: twelve });
    const first = renderBar();
    fireEvent.click(screen.getByRole('button', { name: 'Show 4 more' }));
    first.unmount();
    useAppStore.setState({ sessionViewPrefs: {} });
    renderBar();
    expect(titlesOnScreen()).toHaveLength(12);
    expect(useAppStore.getState().sessionViewPrefs[harborline.id]?.isFoldOpen).toBe(true);
  });

  it('never folds a session that needs you, whatever the sort', () => {
    const waiting = sessionOf({ goal: 'Zulu waits on you' });
    seedColumn({ store: useAppStore, sessions: [...twelve, waiting], questions: [waiting] });
    act(() => {
      useAppStore.getState().setSessionViewPrefs({
        workspaceId: harborline.id,
        patch: { sort: 'goal' },
      });
    });
    renderBar();
    expect(titlesOnScreen()).toContain('Zulu waits on you');
    expect(screen.getByRole('button', { name: 'Show 4 more' })).toBeDefined();
  });

  it('shows no fold row when every session fits', () => {
    seedColumn({ store: useAppStore, sessions: twelve.slice(0, 5) });
    renderBar();
    expect(screen.queryByRole('button', { name: /^Show \d+ more|^Show fewer/ })).toBeNull();
  });
});

describe('the empty list', () => {
  it('says there are no sessions yet', () => {
    seedColumn({ store: useAppStore, sessions: [] });
    renderBar();
    expect(screen.getByText('No sessions yet')).toBeDefined();
  });
});

describe('pinned sessions', () => {
  const ledger = sessionOf({
    goal: 'Reconcile the ledger export',
    lastOpenedAt: '2026-10-01T09:00:00.000Z',
  });
  const payments = sessionOf({
    goal: 'Paginate the payments list',
    lastOpenedAt: '2026-10-02T09:00:00.000Z',
  });
  const relay = sessionOf({
    goal: 'Stop notify-relay retries',
    lastOpenedAt: '2026-10-06T09:00:00.000Z',
  });
  const digest = sessionOf({
    goal: 'Write the notify-relay digest',
    lastOpenedAt: '2026-10-05T09:00:00.000Z',
  });

  const pin = (...sessions: ReadonlyArray<typeof ledger>) =>
    useAppStore.setState({
      sessionPins: {
        [harborline.id]: sessions.map((session, index) => ({
          id: session.id as SessionId,
          at: index + 1,
        })),
      },
    });

  it('lists the pinned sessions first, in pin order, under a Pinned label', () => {
    seedColumn({ store: useAppStore, sessions: [relay, digest, ledger, payments] });
    pin(ledger, payments);
    renderBar();

    expect(titlesOnScreen()).toEqual([
      'Reconcile the ledger export',
      'Paginate the payments list',
      'Stop notify-relay retries',
      'Write the notify-relay digest',
    ]);
    expect(screen.getByText('Pinned')).toBeDefined();
    expect(screen.getByText('Other sessions')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Pinned/ })).toBeNull();
  });

  it('draws no label and no group while nothing is pinned', () => {
    seedColumn({ store: useAppStore, sessions: [relay, digest] });
    renderBar();

    expect(screen.queryByText('Pinned')).toBeNull();
    expect(screen.queryByText('Other sessions')).toBeNull();
  });

  it('shows a pinned session once, ahead of a fold that would hide it, and counts the fold without it', () => {
    const twelve = Array.from({ length: 12 }, (_, index) =>
      sessionOf({
        goal: `Session ${String(index + 1).padStart(2, '0')}`,
        lastOpenedAt: `2026-10-06T${String(20 - index).padStart(2, '0')}:00:00.000Z`,
      }),
    );
    const last = twelve[11] as (typeof twelve)[number];
    seedColumn({ store: useAppStore, sessions: twelve });
    pin(last);
    renderBar();

    const titles = titlesOnScreen();
    expect(titles[0]).toBe('Session 12');
    expect(titles.filter((title) => title === 'Session 12')).toHaveLength(1);
    expect(titles).toHaveLength(9);
    expect(screen.getByRole('button', { name: 'Show 3 more' })).toBeDefined();
  });

  it('keeps pinned sessions on top when the list is grouped, and folds the group with its toggle', () => {
    seedColumn({ store: useAppStore, sessions: [relay, digest, ledger] });
    pin(ledger);
    act(() => {
      useAppStore.getState().setSessionViewPrefs({
        workspaceId: harborline.id,
        patch: { group: 'stage' },
      });
    });
    renderBar();

    const toggle = screen.getByRole('button', { name: /^Pinned/ });
    expect(titlesOnScreen()[0]).toBe('Reconcile the ledger export');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: /^Pinned/ }).getAttribute('aria-expanded')).toBe(
      'false',
    );
    expect(titlesOnScreen()).not.toContain('Reconcile the ledger export');
  });

  it('shows an archived pinned session only under Archived and only when archived sessions are shown', () => {
    seedColumn({ store: useAppStore, sessions: [relay], archived: [ledger] });
    pin(ledger);
    renderBar();

    expect(titlesOnScreen()).toEqual(['Stop notify-relay retries']);
    expect(screen.queryByText('Pinned')).toBeNull();
    act(() => {
      useAppStore.getState().setSessionViewPrefs({
        workspaceId: harborline.id,
        patch: { isArchivedShown: true },
      });
    });

    expect(
      titlesOnScreen().filter((title) => title === 'Reconcile the ledger export'),
    ).toHaveLength(1);
    expect(screen.queryByText('Pinned')).toBeNull();
  });

  it('brings a restored pinned session back under Pinned', () => {
    seedColumn({ store: useAppStore, sessions: [relay], archived: [ledger] });
    pin(ledger);
    renderBar();
    expect(screen.queryByText('Pinned')).toBeNull();

    act(() => {
      seedColumn({ store: useAppStore, sessions: [relay, ledger] });
    });

    expect(titlesOnScreen()).toEqual(['Reconcile the ledger export', 'Stop notify-relay retries']);
    expect(screen.getByText('Pinned')).toBeDefined();
  });

  it('draws the pinned row like any other row, with no extra mark at rest', () => {
    seedColumn({ store: useAppStore, sessions: [relay, ledger] });
    pin(ledger);
    renderBar();

    const pinned = rowOf('Reconcile the ledger export');
    const plain = rowOf('Stop notify-relay retries');
    expect(pinned.children).toHaveLength(plain.children.length);
  });
});
