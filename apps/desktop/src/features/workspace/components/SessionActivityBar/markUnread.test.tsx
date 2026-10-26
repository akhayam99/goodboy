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
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react';
import { brandId, type AgentId, type IsoDateTime, type Session } from '@goodboy/types';
import { anAgent } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../../../store/storyHarness';
import { renderBar, seedColumn, sessionOf } from '../../testing/sessionColumn';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  localStorage.clear();
});

afterEach(cleanup);

const first = sessionOf({ goal: 'Reply to read', lastOpenedAt: '2026-10-06T09:00:00.000Z' });
const second = sessionOf({ goal: 'Another reply', lastOpenedAt: '2026-10-06T08:00:00.000Z' });
const calm = sessionOf({ goal: 'Already read', lastOpenedAt: '2026-10-06T07:00:00.000Z' });

const iso = (value: string) => brandId<IsoDateTime>({ value });

type AgentParams = {
  readonly session: Session;
  readonly isSeen: boolean;
};

const agentOf = ({ session, isSeen }: AgentParams) =>
  anAgent({
    id: brandId<AgentId>({ value: `agent-${session.id}` }),
    sessionId: session.id,
    status: 'completed',
    lastFinishedAt: iso('2026-10-06T09:00:00.000Z'),
    ...(isSeen && { lastViewedAt: iso('2026-10-06T10:00:00.000Z') }),
  });

const mount = () => {
  seedColumn({ store: useAppStore, sessions: [first, second, calm] });
  useAppStore.setState({
    sessionPhaseRuns: {
      [first.id]: [agentOf({ session: first, isSeen: false })],
      [second.id]: [agentOf({ session: second, isSeen: false })],
      [calm.id]: [agentOf({ session: calm, isSeen: true })],
    },
  });
  return renderBar();
};

const rows = (): ReadonlyArray<HTMLElement> =>
  screen.getAllByRole('option').filter((option) => option.hasAttribute('data-select-id'));

const rowOf = (title: string): HTMLElement => {
  const row = rows().find((candidate) => candidate.textContent?.includes(title) === true);
  if (row === undefined) {
    throw new Error(`no row for ${title}`);
  }
  return row;
};

const isLit = (row: HTMLElement): boolean =>
  row.querySelector('[role="img"]')?.getAttribute('aria-label')?.endsWith(', unseen') === true;

const openMenu = () => {
  fireEvent.click(screen.getByRole('button', { name: 'Filter sessions' }));
  return screen.getByRole('dialog', { name: 'Filter sessions' });
};

describe('Mark all as read in the Sessions options menu', () => {
  it('lights the rows that have a reply to read, and only those', () => {
    mount();

    expect(isLit(rowOf('Reply to read'))).toBe(true);
    expect(isLit(rowOf('Another reply'))).toBe(true);
    expect(isLit(rowOf('Already read'))).toBe(false);
  });

  it('clears every unread row at once', async () => {
    mount();
    const menu = openMenu();

    await act(async () => {
      fireEvent.click(within(menu).getByRole('button', { name: 'Mark all as read' }));
    });

    expect(isLit(rowOf('Reply to read'))).toBe(false);
    expect(isLit(rowOf('Another reply'))).toBe(false);
  });

  it('is disabled while nothing is unread', async () => {
    mount();
    const menu = openMenu();
    await act(async () => {
      fireEvent.click(within(menu).getByRole('button', { name: 'Mark all as read' }));
    });

    const button = within(menu).getByRole('button', { name: 'Mark all as read' });

    expect(button.hasAttribute('disabled')).toBe(true);
  });

  it('leaves a session with nothing to read alone', async () => {
    mount();
    const menu = openMenu();

    await act(async () => {
      fireEvent.click(within(menu).getByRole('button', { name: 'Mark all as read' }));
    });

    expect(useAppStore.getState().sessionPhaseRuns[calm.id]?.[0]?.lastViewedAt).toBe(
      iso('2026-10-06T10:00:00.000Z'),
    );
  });
});

describe('a session marked as unread', () => {
  it('lights its row, and keeps it lit after the pointer rests on the row', async () => {
    mount();
    await act(async () => {
      await useAppStore.getState().markSessionUnread({ sessionId: calm.id });
    });
    const row = rowOf('Already read');
    expect(isLit(row)).toBe(true);

    vi.useFakeTimers();
    fireEvent.mouseEnter(row);
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    fireEvent.mouseLeave(row);
    vi.useRealTimers();

    expect(isLit(rowOf('Already read'))).toBe(true);
  });

  it('clears again with Mark all as read', async () => {
    mount();
    await act(async () => {
      await useAppStore.getState().markSessionUnread({ sessionId: calm.id });
    });
    const menu = openMenu();

    await act(async () => {
      fireEvent.click(within(menu).getByRole('button', { name: 'Mark all as read' }));
    });

    expect(isLit(rowOf('Already read'))).toBe(false);
  });
});
