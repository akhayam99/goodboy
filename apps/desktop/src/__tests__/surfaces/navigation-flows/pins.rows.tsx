import { expect } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import {
  type BridgeArgs,
  type Row,
  WAIT,
  bridge,
  openPalette,
  settle,
  useAppStore,
} from './harness';

const PINS_KEY_PREFIX = 'sessions.pinned.';

const stored = new Map<string, string>();

let targetId = '';

let orderBefore: ReadonlyArray<string> = [];

let isMountlessArchive = false;

export const resetPinsBridge = (): void => {
  stored.clear();
  isMountlessArchive = false;
};

const isPinsKey = (value: unknown): value is string =>
  typeof value === 'string' && value.startsWith(PINS_KEY_PREFIX);

const sessionIdsInStore = (): ReadonlyArray<{ readonly id: string }> => {
  const state = useAppStore.getState();
  return [...state.sessions, ...Object.values(state.archivedSessions).flat()].map((session) => ({
    id: session.id,
  }));
};

export const pinsBridge = (command: string, args?: BridgeArgs): Promise<unknown> => {
  const sql = args?.sql ?? '';
  const params = args?.params ?? [];
  if (command === 'db_select' && /FROM settings WHERE key = \?/.test(sql) && isPinsKey(params[0])) {
    const value = stored.get(params[0]);
    return Promise.resolve(value === undefined ? [] : [{ key: params[0], value, updated_at: 1 }]);
  }
  if (
    command === 'db_select' &&
    /FROM sessions WHERE workspace_id = \? AND deleted_at IS NULL/.test(sql)
  ) {
    return Promise.resolve(sessionIdsInStore());
  }
  if (command === 'db_execute' && /INSERT INTO settings[\s\S]*DO NOTHING/.test(sql)) {
    const [key, value] = params;
    if (!isPinsKey(key) || typeof value !== 'string' || stored.has(key)) {
      return Promise.resolve({ rowsAffected: 0 });
    }
    stored.set(key, value);
    return Promise.resolve({ rowsAffected: 1 });
  }
  if (command === 'db_execute' && /UPDATE settings SET value = \?/.test(sql)) {
    const [value, , key, expected] = params;
    if (!isPinsKey(key) || typeof value !== 'string' || stored.get(key) !== expected) {
      return Promise.resolve({ rowsAffected: 0 });
    }
    stored.set(key, value);
    return Promise.resolve({ rowsAffected: 1 });
  }
  if (
    command === 'db_select' &&
    isMountlessArchive &&
    /FROM session_worktrees WHERE session_id = \?/.test(sql)
  ) {
    return Promise.resolve([]);
  }
  return bridge(command, args);
};

const rowIds = (): ReadonlyArray<string> =>
  Array.from(
    document.querySelectorAll('[data-column-sessions] button[data-select-id]'),
    (row) => row.getAttribute('data-select-id') ?? '',
  );

const rowOf = (sessionId: string): HTMLElement => {
  const row = document.querySelector<HTMLElement>(
    `[data-column-sessions] button[data-select-id="${sessionId}"]`,
  );
  expect(row).not.toBeNull();
  return row as HTMLElement;
};

const sessionsList = (): HTMLElement => {
  const list = document.querySelector<HTMLElement>('[data-column-sessions]');
  expect(list).not.toBeNull();
  return list as HTMLElement;
};

const pinnedIds = (): ReadonlyArray<string> => {
  const state = useAppStore.getState();
  const workspaceId = state.currentWorkspaceId as WorkspaceId;
  return (state.sessionPins[workspaceId] ?? []).map((pin) => pin.id);
};

const otherSessionId = (current: SessionId): string => {
  const others = rowIds().filter((id) => id !== current);
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
  fireEvent.contextMenu(rowOf(sessionId));
  const item = await screen.findByRole('menuitem', { name: label }, WAIT);
  fireEvent.click(item);
  await settle();
};

const expectPinnedOnTop = async ({ sessionId }: { readonly sessionId: string }): Promise<void> => {
  await waitFor(() => {
    expect(pinnedIds()).toContain(sessionId);
    expect(rowIds()[0]).toBe(sessionId);
    expect(within(sessionsList()).getByText('Pinned')).toBeDefined();
  }, WAIT);
};

const pinThroughTheStore = async ({ sessionId }: { readonly sessionId: string }): Promise<void> => {
  await useAppStore.getState().pinSession(sessionId as SessionId);
  await waitFor(() => expect(rowIds()[0]).toBe(sessionId), WAIT);
};

export const PIN_ROWS: ReadonlyArray<Row> = [
  {
    name: 'pins: Pin session from the row menu moves the session to Pinned at the top',
    covers: ['row menu: Pin session'],
    open: async (ctx) => {
      const target = otherSessionId(ctx.sessionId);
      expect(rowIds()[0]).not.toBe(target);
      await chooseFromRowMenu({ sessionId: target, label: 'Pin session' });
      targetId = target;
    },
    lands: async () => {
      await expectPinnedOnTop({ sessionId: targetId });
      expect(rowIds().filter((id) => id === targetId)).toHaveLength(1);
      fireEvent.contextMenu(rowOf(targetId));
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
      orderBefore = rowIds();
      await pinThroughTheStore({ sessionId: ctx.sessionId });
      expect(within(sessionsList()).getByText('Pinned')).toBeDefined();
      await openPalette(/^Unpin session$/, 'unpin session');
    },
    lands: async (ctx) => {
      await waitFor(() => {
        expect(pinnedIds()).not.toContain(ctx.sessionId);
        expect(within(sessionsList()).queryByText('Pinned')).toBeNull();
      }, WAIT);
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
      await waitFor(() => expect(rowIds()).not.toContain(target), WAIT);
      expect(within(sessionsList()).queryByText('Pinned')).toBeNull();
      expect(pinnedIds()).toContain(target);
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
