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
import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import type { Agent, AgentId, IsoDateTime, Session, SessionId } from '@goodboy/types';
import { brandId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import {
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

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type AgoParams = {
  readonly ms: number;
};

type RootParams = {
  readonly root: ParentNode;
};

const ago = ({ ms }: AgoParams): string => new Date(Date.now() - ms).toISOString();

const quietFor = ({ goal, ms }: { readonly goal: string; readonly ms: number }): Session =>
  sessionOf({
    goal,
    createdAt: ago({ ms: 40 * DAY_MS }),
    updatedAt: ago({ ms: ms }),
    lastOpenedAt: ago({ ms: ms }),
    state: { kind: 'idle', lastActivityAt: brandId<IsoDateTime>({ value: ago({ ms }) }) },
  });

const agentOf = ({ session }: { readonly session: Session }): Agent => ({
  id: brandId<AgentId>({ value: `agent-${session.id}` }),
  sessionId: session.id,
  ordinal: 1,
  name: 'Implement',
  status: 'completed',
});

type Row = {
  readonly title: string;
  readonly trailing: string | null;
};

const rowsOf = ({ root }: RootParams): ReadonlyArray<Row> =>
  Array.from(root.querySelectorAll<HTMLElement>('button[data-select-id]')).map((button) => ({
    title:
      button.querySelector('[data-row-trailing]')?.previousElementSibling?.textContent ??
      button.lastElementChild?.textContent ??
      '',
    trailing: button.querySelector('[data-row-trailing]')?.textContent ?? null,
  }));

const inactiveGroup = (): HTMLElement | null => {
  const header = screen.queryByText('Inactive');
  return header?.closest('div.flex.flex-col') ?? null;
};

const titles = (): ReadonlyArray<string> => rowsOf({ root: document }).map((row) => row.title);

const recent = quietFor({ goal: 'Tune the payments rate limiter', ms: 2 * HOUR_MS });
const settlement = quietFor({ goal: 'Backfill the settlement dates', ms: 5 * DAY_MS });
const digest = quietFor({ goal: 'Write the notify-relay digest', ms: 9 * DAY_MS });
const pinned = quietFor({ goal: 'Reconcile the ledger export', ms: 12 * DAY_MS });
const asking = quietFor({ goal: 'Stop notify-relay retries on a 409', ms: 10 * DAY_MS });
const drafted = quietFor({ goal: 'Add idempotency keys to payments-api', ms: 8 * DAY_MS });
const running = {
  ...quietFor({ goal: 'Move the ledger export to a queue', ms: 6 * DAY_MS }),
  state: runningState(),
};
const open = {
  ...quietFor({ goal: 'Paginate the payments list', ms: 7 * DAY_MS }),
  lastOpenedAt: brandId<IsoDateTime>({ value: ago({ ms: HOUR_MS }) }),
};

const ALL = [recent, settlement, digest, pinned, asking, drafted, running, open];

const seed = () => {
  seedColumn({
    store: useAppStore,
    sessions: ALL,
    currentSessionId: open.id,
    questions: [asking],
  });
  useAppStore.setState({
    sessionPins: { [harborline.id]: [{ id: pinned.id, at: Date.now() }] },
    sessionPhaseRuns: { [drafted.id]: [agentOf({ session: drafted })] },
    agentDraft: {
      [brandId<AgentId>({ value: `agent-${drafted.id}` })]: 'Check the retry header first',
    },
  });
};

describe('the Inactive group of the session list', () => {
  it('moves only the quiet sessions to a last Inactive group, newest first, with how long they slept', async () => {
    seed();
    renderBar();

    await waitFor(() => expect(screen.getByText('Inactive')).toBeDefined());
    const group = inactiveGroup();
    if (group === null) {
      throw new Error('the list has no Inactive group');
    }
    expect(group.textContent).toContain('Inactive2');
    expect(rowsOf({ root: group })).toEqual([
      { title: 'Backfill the settlement dates', trailing: 'inactive 5d' },
      { title: 'Write the notify-relay digest', trailing: 'inactive 9d' },
    ]);
    expect(titles().slice(-2)).toEqual([
      'Backfill the settlement dates',
      'Write the notify-relay digest',
    ]);
    for (const kept of [pinned, asking, drafted, running, open, recent]) {
      expect(titles().indexOf(kept.goal)).toBeLessThan(titles().length - 2);
    }
    expect(rowsOf({ root: document }).filter((row) => row.trailing !== null)).toHaveLength(2);
  });

  it('brings an inactive session back up the moment you open it', async () => {
    seed();
    renderBar({ onSelectSession: (id) => void useAppStore.getState().setCurrentSession(id) });
    await waitFor(() => expect(screen.getByText('Inactive')).toBeDefined());

    fireEvent.click(screen.getByRole('button', { name: /^Write the notify-relay digest/ }));

    await waitFor(() =>
      expect(rowsOf({ root: inactiveGroup() ?? document }).map((row) => row.title)).toEqual([
        'Backfill the settlement dates',
      ]),
    );
    expect(
      rowsOf({ root: document }).find((row) => row.title === 'Write the notify-relay digest')
        ?.trailing,
    ).toBeNull();
  });

  it('brings an inactive session back up the moment an agent starts in it, and drops the group when none is left', async () => {
    seed();
    renderBar();
    await waitFor(() => expect(screen.getByText('Inactive')).toBeDefined());

    act(() => {
      useAppStore.setState({
        sessions: ALL.map((session) =>
          session.id === settlement.id ? { ...session, state: runningState() } : session,
        ),
      });
    });
    expect(rowsOf({ root: inactiveGroup() ?? document }).map((row) => row.title)).toEqual([
      'Write the notify-relay digest',
    ]);

    act(() => {
      useAppStore.setState({
        sessions: useAppStore
          .getState()
          .sessions.map((session) =>
            session.id === digest.id
              ? { ...session, updatedAt: brandId<IsoDateTime>({ value: ago({ ms: 0 }) }) }
              : session,
          ),
      });
    });
    expect(screen.queryByText('Inactive')).toBeNull();
    expect(rowsOf({ root: document }).every((row) => row.trailing === null)).toBe(true);
  });
});
