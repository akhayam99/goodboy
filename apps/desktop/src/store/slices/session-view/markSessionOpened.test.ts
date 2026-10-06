// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../storyHarness')).dbModuleMock());
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).dbLibModuleMock(),
);

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { aSession, aWorkspace } from '@goodboy/types/testing';
import type { IsoDateTime, SessionId } from '@goodboy/types';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../storyHarness';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

const workspace = aWorkspace({ name: 'Harborline' });
const open = aSession({ workspaceId: workspace.id, goal: 'Fix webhook retries' });
const other = aSession({ workspaceId: workspace.id, goal: 'Ledger export speedup' });
const archived = aSession({
  workspaceId: workspace.id,
  goal: 'Legacy hook cleanup',
  archivedAt: '2026-09-01T09:00:00.000Z' as IsoDateTime,
});

beforeEach(async () => {
  await resetStoryStore();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-06T10:30:00.000Z'));
  useAppStore.setState({
    workspaces: [workspace],
    currentWorkspaceId: workspace.id,
    sessions: [open, other],
    archivedSessions: { [workspace.id]: [archived] },
  });
});

afterEach(() => {
  vi.useRealTimers();
});

const stampOf = (id: SessionId) =>
  useAppStore.getState().sessions.find((session) => session.id === id)?.lastOpenedAt;

describe('markSessionOpened', () => {
  it('stamps the session in the store and writes the same moment to the database', () => {
    useAppStore.getState().markSessionOpened({ sessionId: open.id as SessionId });
    expect(stampOf(open.id as SessionId)).toBe('2026-10-06T10:30:00.000Z');
    expect(storySpies.markSessionOpened).toHaveBeenCalledWith({
      db: expect.anything(),
      id: open.id,
      openedAt: '2026-10-06T10:30:00.000Z',
    });
  });

  it('leaves the other sessions alone', () => {
    useAppStore.getState().markSessionOpened({ sessionId: open.id as SessionId });
    expect(stampOf(other.id as SessionId)).toBeUndefined();
  });

  it('stamps an archived session without touching the live list', () => {
    const live = useAppStore.getState().sessions;
    useAppStore.getState().markSessionOpened({ sessionId: archived.id as SessionId });
    expect(useAppStore.getState().archivedSessions[workspace.id]?.[0]?.lastOpenedAt).toBe(
      '2026-10-06T10:30:00.000Z',
    );
    expect(useAppStore.getState().sessions.map((session) => session.lastOpenedAt)).toEqual(
      live.map((session) => session.lastOpenedAt),
    );
  });

  it('keeps the store stamp when the database refuses the write', async () => {
    storySpies.markSessionOpened.mockRejectedValueOnce(new Error('database is locked'));
    useAppStore.getState().markSessionOpened({ sessionId: open.id as SessionId });
    await vi.advanceTimersByTimeAsync(0);
    expect(stampOf(open.id as SessionId)).toBe('2026-10-06T10:30:00.000Z');
  });
});

describe('opening a session', () => {
  it('records the open once per move to a different session', async () => {
    await useAppStore.getState().setCurrentSession(open.id as SessionId);
    await useAppStore.getState().setCurrentSession(open.id as SessionId);
    expect(storySpies.markSessionOpened).toHaveBeenCalledTimes(1);
    await useAppStore.getState().setCurrentSession(other.id as SessionId);
    expect(storySpies.markSessionOpened).toHaveBeenCalledTimes(2);
  });

  it('records nothing when no session is open', async () => {
    await useAppStore.getState().setCurrentSession(null);
    expect(storySpies.markSessionOpened).not.toHaveBeenCalled();
  });

  it('moves the session to the top of the list the moment it opens', async () => {
    await useAppStore.getState().setCurrentSession(other.id as SessionId);
    expect(stampOf(other.id as SessionId)).toBe('2026-10-06T10:30:00.000Z');
  });
});
