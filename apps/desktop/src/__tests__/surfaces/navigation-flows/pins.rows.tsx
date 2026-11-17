import { expect } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import {
  type BridgeArgs,
  type Row,
  WAIT,
  bridge,
  openPalette,
  pressBoardKey,
  settle,
  useAppStore,
} from './harness';

const stored = new Map<string, string>();

let targetId = '';

let orderBefore: ReadonlyArray<string> = [];

let isMountlessArchive = false;

export const resetPinsBridge = (): void => {
  stored.clear();
  isMountlessArchive = false;
};

const PINS_KEY = 'sessions.pinned';

type SlotParams = {
  readonly workspaceId: unknown;
  readonly key: unknown;
};

const pinsSlot = ({ workspaceId, key }: SlotParams) =>
  typeof workspaceId === 'string' && key === PINS_KEY ? workspaceId : null;

const sessionIdsInStore = (): ReadonlyArray<{ readonly id: string }> => {
  const state = useAppStore.getState();
  return [...state.sessions, ...Object.values(state.archivedSessions).flat()].map((session) => ({
    id: session.id,
  }));
};

export const pinsBridge = (command: string, args?: BridgeArgs): Promise<unknown> => {
  const sql = args?.sql ?? '';
  const params = args?.params ?? [];
  const selectedSlot = pinsSlot({ workspaceId: params[0], key: params[1] });
  if (
    command === 'db_select' &&
    /FROM workspace_values WHERE workspace_id = \? AND key = \?/.test(sql) &&
    selectedSlot !== null
  ) {
    const value = stored.get(selectedSlot);
    return Promise.resolve(value === undefined ? [] : [{ value }]);
  }
  if (
    command === 'db_select' &&
    /FROM sessions WHERE workspace_id = \? AND deleted_at IS NULL/.test(sql)
  ) {
    return Promise.resolve(sessionIdsInStore());
  }
  if (command === 'db_execute' && /INSERT INTO workspace_values[\s\S]*DO NOTHING/.test(sql)) {
    const [workspaceId, key, value] = params;
    const slot = pinsSlot({ workspaceId, key });
    if (slot === null || typeof value !== 'string' || stored.has(slot)) {
      return Promise.resolve({ rowsAffected: 0 });
    }
    stored.set(slot, value);
    return Promise.resolve({ rowsAffected: 1 });
  }
  if (command === 'db_execute' && /UPDATE workspace_values SET value = \?/.test(sql)) {
    const [value, , workspaceId, key, expected] = params;
    const slot = pinsSlot({ workspaceId, key });
    if (slot === null || typeof value !== 'string' || stored.get(slot) !== expected) {
      return Promise.resolve({ rowsAffected: 0 });
    }
    stored.set(slot, value);
    return Promise.resolve({ rowsAffected: 1 });
  }
  if (
    command === 'db_select' &&
    isMountlessArchive &&
    /FROM session_worktrees WHERE session_id = \?/.test(sql)
  ) {
    return Promise.resolve([]);
  }
  if (command === 'browser_session_close') {
    return Promise.resolve({ closed: 0, failed: [] });
  }
  if (command === 'browser_session_tab_rows_delete') {
    return Promise.resolve(0);
  }
  return bridge(command, args);
};

const sessionsList = (): HTMLElement | null =>
  document.querySelector<HTMLElement>('[role="listbox"][aria-label="Sessions"]');

const idOfRow = (row: Element): string => {
  const text = row.textContent ?? '';
  const session = useAppStore
    .getState()
    .sessions.filter((candidate) => text.startsWith(candidate.goal))
    .sort((a, b) => b.goal.length - a.goal.length)[0];
  return session?.id ?? '';
};

const rowIds = (): ReadonlyArray<string> => {
  const list = sessionsList();
  return list === null ? [] : Array.from(list.querySelectorAll('[role="option"]'), idOfRow);
};

const openSessions = async (): Promise<void> => {
  if (sessionsList() !== null) {
    return;
  }
  fireEvent.click(screen.getByRole('button', { name: 'Sessions' }));
  await settle();
};

const closeSessions = async (): Promise<void> => {
  if (sessionsList() === null) {
    return;
  }
  fireEvent.click(screen.getByRole('button', { name: 'Sessions' }));
  await settle();
};

const cardOf = (sessionId: string): HTMLElement => {
  const card = document.querySelector<HTMLElement>(`article[data-select-id="${sessionId}"]`);
  expect(card).not.toBeNull();
  return card as HTMLElement;
};

const onBoard = async (): Promise<void> => {
  await closeSessions();
  if (document.querySelector('article[data-select-id]') !== null) {
    return;
  }
  await pressBoardKey();
};

const pinnedIds = (): ReadonlyArray<string> => {
  const state = useAppStore.getState();
  const workspaceId = state.currentWorkspaceId as WorkspaceId;
  return (state.sessionPins[workspaceId] ?? []).map((pin) => pin.id);
};

const otherSessionId = (current: SessionId): string => {
  const others = useAppStore
    .getState()
    .sessions.filter((session) => session.id !== current && session.state.kind === 'idle')
    .map((session) => session.id);
  const last = others.at(-1);
  expect(last).toBeDefined();
  return last as string;
};

const chooseFromRowMenu = async ({
  sessionId,
  label,
}: {
  readonly sessionId: string;
  readonly label: RegExp | string;
}): Promise<void> => {
  await onBoard();
  fireEvent.contextMenu(cardOf(sessionId));
  const item = await screen.findByRole('menuitem', { name: label }, WAIT);
  fireEvent.click(item);
  await settle();
};

const expectPinnedOnTop = async ({ sessionId }: { readonly sessionId: string }): Promise<void> => {
  await openSessions();
  await waitFor(() => {
    expect(pinnedIds()).toContain(sessionId);
    expect(rowIds()[0]).toBe(sessionId);
    within(sessionsList() as HTMLElement).getByText('Pinned');
  }, WAIT);
};

const pinThroughTheStore = async ({ sessionId }: { readonly sessionId: string }): Promise<void> => {
  await useAppStore.getState().pinSession(sessionId as SessionId);
  await openSessions();
  await waitFor(() => expect(rowIds()[0]).toBe(sessionId), WAIT);
};

export const PIN_ROWS: ReadonlyArray<Row> = [
  {
    name: 'pins: Pin session from the card menu moves the session to Pinned at the top of Sessions',
    covers: ['row menu: Pin session'],
    open: async (ctx) => {
      const target = otherSessionId(ctx.sessionId);
      expect(pinnedIds()).not.toContain(target);
      await chooseFromRowMenu({ sessionId: target, label: 'Pin session' });
      targetId = target;
    },
    lands: async () => {
      await expectPinnedOnTop({ sessionId: targetId });
      expect(rowIds().filter((id) => id === targetId)).toHaveLength(1);
      await onBoard();
      fireEvent.contextMenu(cardOf(targetId));
      expect(await screen.findByRole('menuitem', { name: 'Unpin session' }, WAIT)).toBeDefined();
      expect(screen.queryByRole('menuitem', { name: 'Pin session' })).toBeNull();
    },
  },
  {
    name: 'palette verb: Pin session pins the open session',
    covers: ['palette:Pin session'],
    open: async () => openPalette(/^Pin session$/, 'pin session'),
    lands: async (ctx) => expectPinnedOnTop({ sessionId: ctx.sessionId }),
  },
  {
    name: 'palette verb: Unpin session moves the session back into the list',
    covers: ['palette:Unpin session'],
    open: async (ctx) => {
      await openSessions();
      orderBefore = rowIds();
      await pinThroughTheStore({ sessionId: ctx.sessionId });
      within(sessionsList() as HTMLElement).getByText('Pinned');
      await closeSessions();
      await openPalette(/^Unpin session$/, 'unpin session');
    },
    lands: async (ctx) => {
      await waitFor(() => expect(pinnedIds()).not.toContain(ctx.sessionId), WAIT);
      await openSessions();
      await waitFor(
        () => expect(within(sessionsList() as HTMLElement).queryByText('Pinned')).toBeNull(),
        WAIT,
      );
      expect(rowIds()).toEqual(orderBefore);
    },
  },
  {
    name: 'pins: archiving a pinned session takes it off the list and Undo brings it back under Pinned',
    covers: ['row menu: Archive', 'toast: Undo'],
    open: async (ctx) => {
      const target = otherSessionId(ctx.sessionId);
      await pinThroughTheStore({ sessionId: target });
      isMountlessArchive = true;
      await chooseFromRowMenu({ sessionId: target, label: /^Archive/ });
      await openSessions();
      await waitFor(() => expect(rowIds()).not.toContain(target), WAIT);
      expect(within(sessionsList() as HTMLElement).queryByText('Pinned')).toBeNull();
      expect(pinnedIds()).toContain(target);
      await closeSessions();
      fireEvent.click(await screen.findByRole('button', { name: 'Undo' }, WAIT));
      await settle();
      targetId = target;
    },
    lands: async () => {
      await expectPinnedOnTop({ sessionId: targetId });
      expect(rowIds().filter((id) => id === targetId)).toHaveLength(1);
    },
  },
];
