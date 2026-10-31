// @vitest-environment happy-dom
vi.hoisted(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-18T10:31:00.000Z'));
});

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../../store/storyHarness')).tauriEventModuleMock(),
);

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { brandId, type AgentId, type IsoDateTime } from '@goodboy/types';
import { ToastProvider } from '../../../../../shared/components/Toast';
import {
  importStore,
  resetStoryStore,
  storySpies,
  STORE_IMPORT_TIMEOUT_MS,
} from '../../../../../store/storyHarness';
import { installFakeResizeObserver } from '../../../../../test/fakeResizeObserver';
import { sceneInvoke, clearSceneInvoke } from '../../../../../test/sceneInvoke';
import { resetWorktreeStatusCache } from '../../../../../store/runtime/worktreeStatuses/cache';
import { AutoReleaseContext } from '../../../../auto/autoReleaseContext';
import {
  COLUMN_SESSION_ID,
  seedCentralColumn,
  type ColumnKind,
} from '../../../../../app/components/MockScene/scenes/u26/centralColumnSeed';

let useAppStore: Awaited<ReturnType<typeof importStore>>;
let SessionOverviewPane: typeof import('../../../components/SessionOverviewPane').SessionOverviewPane;

beforeAll(async () => {
  installFakeResizeObserver();
  Element.prototype.scrollIntoView = vi.fn();
  useAppStore = await importStore();
  ({ SessionOverviewPane } = await import('../../../components/SessionOverviewPane'));
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  resetWorktreeStatusCache();
  clearSceneInvoke();
  storySpies.tauriInvoke.mockImplementation((command, args) => {
    if (typeof command !== 'string') {
      throw new Error('The scene command must be a string.');
    }
    return sceneInvoke({ command, args });
  });
});

afterEach(cleanup);

afterAll(() => {
  vi.useRealTimers();
});

const mountedSession = () => {
  const session = useAppStore
    .getState()
    .sessions.find((candidate) => candidate.id === COLUMN_SESSION_ID);
  if (session === undefined) {
    throw new Error('The seed must hold the session');
  }
  return session;
};

const settle = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

type ShowParams = {
  readonly kind: ColumnKind;
};

const show = async ({ kind }: ShowParams) => {
  seedCentralColumn({ kind });
  render(
    <ToastProvider>
      <AutoReleaseContext.Provider value>
        <SessionOverviewPane session={mountedSession()} />
      </AutoReleaseContext.Provider>
    </ToastProvider>,
  );
  await settle();
};

const doneCard = () => screen.getByRole('region', { name: 'Done' });

const FINISHED_AT = brandId<IsoDateTime>({ value: '2026-10-18T06:00:00.000Z' });
const VIEWED_AT = brandId<IsoDateTime>({ value: '2026-10-18T07:00:00.000Z' });

const CI_FIX = brandId<AgentId>({ value: 'mock-central-agent-ci-fix' });
const LAST_STEP = brandId<AgentId>({ value: 'mock-central-agent-build-6' });

type UnreadParams = {
  readonly agentIds: ReadonlyArray<AgentId>;
};

const markUnread = ({ agentIds }: UnreadParams) => {
  act(() => {
    useAppStore.setState((state) => ({
      sessionPhaseRuns: {
        ...state.sessionPhaseRuns,
        [COLUMN_SESSION_ID]: (state.sessionPhaseRuns[COLUMN_SESSION_ID] ?? []).map((agent) =>
          agentIds.includes(agent.id)
            ? { ...agent, lastFinishedAt: FINISHED_AT }
            : { ...agent, lastFinishedAt: FINISHED_AT, lastViewedAt: VIEWED_AT },
        ),
      },
    }));
  });
};

const latestRows = () => [...doneCard().querySelectorAll<HTMLElement>('[data-done-latest]')];

const newSinceCard = () => {
  const card = document.querySelector<HTMLElement>('[data-overview-card="new-since"]');
  if (card === null) {
    throw new Error('the new since card is not shown');
  }
  return card;
};

const newSinceRows = () => [
  ...(document
    .querySelector('[data-overview-card="new-since"]')
    ?.querySelectorAll<HTMLElement>('[data-done-latest]') ?? []),
];

const noteOf = () => doneCard().querySelector('[data-overview-note]')?.textContent ?? null;

describe('the Done card lists what finished last', () => {
  it('shows the latest three, newest first, each with its outcome, who did it and its age', async () => {
    await show({ kind: 'finished' });

    const rows = latestRows();
    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.querySelector('.truncate')?.textContent)).toEqual([
      'Fixed the failing static-analysis check',
      'Pushed the branch',
      'Summarised the plan',
    ]);
    expect(rows[0]?.textContent).toContain('CI debugger');
    expect(rows[0]?.textContent).toContain('2m ago');
    expect(doneCard().querySelector('[data-done-line]')).toBeNull();
  });

  it('marks an unread reply with a dot and counts it in the header: Done 5, 2 unread', async () => {
    seedCentralColumn({ kind: 'finished' });
    markUnread({ agentIds: [CI_FIX, LAST_STEP] });
    render(
      <ToastProvider>
        <SessionOverviewPane session={mountedSession()} />
      </ToastProvider>,
    );
    await settle();

    expect(doneCard().querySelector('[data-overview-count]')?.textContent).toBe('5');
    expect(noteOf()).toBe(', 2 unread');
    expect(latestRows().map((row) => row.hasAttribute('data-unread'))).toEqual([true, true, false]);
    expect(within(doneCard()).getAllByRole('img', { name: 'Unread reply' })).toHaveLength(2);
    expect(within(doneCard()).queryByRole('button', { name: 'Mark all seen' })).toBeNull();
  });

  it('lists every unread item in a New since you last looked card above Done, with Mark all seen', async () => {
    seedCentralColumn({ kind: 'finished' });
    markUnread({ agentIds: [CI_FIX, LAST_STEP] });
    render(
      <ToastProvider>
        <SessionOverviewPane session={mountedSession()} />
      </ToastProvider>,
    );
    await settle();

    const cards = [...document.querySelectorAll('[data-overview-card]')].map((card) =>
      card.getAttribute('data-overview-card'),
    );
    expect(cards.indexOf('new-since')).toBe(0);
    expect(cards).toContain('done');
    expect(newSinceRows()).toHaveLength(2);
    expect(newSinceCard().querySelector('[data-new-since-count]')?.textContent).toBe('2');
    within(newSinceCard()).getByRole('button', { name: 'Mark all seen' });
  });

  it('shows no New since you last looked card once everything is seen', async () => {
    seedCentralColumn({ kind: 'finished' });
    markUnread({ agentIds: [] });
    render(
      <ToastProvider>
        <SessionOverviewPane session={mountedSession()} />
      </ToastProvider>,
    );
    await settle();

    expect(document.querySelector('[data-overview-card="new-since"]')).toBeNull();
  });

  it('draws no dot, no note and no Mark all seen once everything is seen', async () => {
    seedCentralColumn({ kind: 'finished' });
    markUnread({ agentIds: [] });
    render(
      <ToastProvider>
        <SessionOverviewPane session={mountedSession()} />
      </ToastProvider>,
    );
    await settle();

    expect(noteOf()).toBeNull();
    expect(within(doneCard()).queryByRole('img', { name: 'Unread reply' })).toBeNull();
    expect(within(doneCard()).queryByRole('button', { name: 'Mark all seen' })).toBeNull();
  });

  it('clears the dots and the note from Mark all seen', async () => {
    seedCentralColumn({ kind: 'finished' });
    markUnread({ agentIds: [CI_FIX] });
    render(
      <ToastProvider>
        <SessionOverviewPane session={mountedSession()} />
      </ToastProvider>,
    );
    await settle();
    expect(noteOf()).toBe(', 1 unread');

    await act(async () => {
      fireEvent.click(within(newSinceCard()).getByRole('button', { name: 'Mark all seen' }));
      await Promise.resolve();
    });
    await settle();

    expect(noteOf()).toBeNull();
    expect(within(doneCard()).queryByRole('img', { name: 'Unread reply' })).toBeNull();
  });

  it('opens the agent from its row, and falls back to the full log for a row with no page', async () => {
    await show({ kind: 'finished' });
    const navigate = vi.fn();
    const openDrawer = vi.fn();
    act(() => {
      useAppStore.setState({ navigate, openDrawer });
    });

    fireEvent.click(within(latestRows()[1] ?? doneCard()).getByRole('button'));

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(navigate.mock.calls[0])).toContain('mock-central-run-build');
  });

  it('keeps the list on an archived session, which holds only this card', async () => {
    seedCentralColumn({ kind: 'finished' });
    act(() => {
      useAppStore.setState((state) => ({
        sessions: state.sessions.map((session) => ({
          ...session,
          archivedAt: brandId<IsoDateTime>({ value: '2026-10-18T10:00:00.000Z' }),
        })),
      }));
    });
    render(
      <ToastProvider>
        <SessionOverviewPane session={mountedSession()} />
      </ToastProvider>,
    );
    await settle();

    expect(
      [...document.querySelectorAll('[data-overview-card]')].map((card) =>
        card.getAttribute('data-overview-card'),
      ),
    ).toEqual(['done']);
    expect(latestRows()).toHaveLength(3);
  });
});
