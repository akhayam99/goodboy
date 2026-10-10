vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../shared/lib/db', async () =>
  (await import('../../storyHarness')).sqliteDbLibModuleMock(),
);

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { insertSession, insertWorkspace, listContextSlotsForSession } from '@goodboy/db';
import { aSession } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  buildStoryWorkspace,
  importStore,
  injectDbFault,
  openStorySqlite,
  resetStoryStore,
  rowsOf,
  storySqlite,
  type StoryStore,
} from '../../storyHarness';
import { applyGoalFromWork } from './applyGoalFromWork';

let store: StoryStore;
const session = aSession({ goal: 'Fix credits' });
const other = aSession({ workspaceId: session.workspaceId, goal: 'Northwind export' });
const next = {
  sessionId: session.id,
  title: 'Prevent duplicate credits',
  goal: 'Credit each invoice once.',
};
const originalGoal = 'Keep the invoice ledger consistent.';
const values = async () => ({
  title: (
    await rowsOf<{ goal: string }>({
      sql: 'SELECT goal FROM sessions WHERE id = ?',
      params: [session.id],
    })
  )[0]?.goal,
  goal: (await listContextSlotsForSession(storySqlite(), session.id)).find(
    (slot) => slot.key === 'goal',
  )?.value,
});

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);
beforeEach(async () => {
  await resetStoryStore();
  const db = await openStorySqlite();
  await insertWorkspace({
    db,
    workspace: buildStoryWorkspace({ id: session.workspaceId, name: 'Harborline' }),
  });
  await insertSession(db, session);
  await insertSession(db, other);
  store.setState({ sessions: [session, other] });
  await store.getState().upsertSessionSlot(session.id, 'goal', originalGoal);
});

describe('title and goal writes with real SQLite', () => {
  it('writes both values and Undo restores both on the captured session', async () => {
    await applyGoalFromWork(next);
    expect(await values()).toEqual({ title: next.title, goal: next.goal });
    store.setState({ currentSessionId: other.id });
    expect(await store.getState().undoLastOperation({})).toBe(true);
    expect(await values()).toEqual({ title: session.goal, goal: originalGoal });
    expect(store.getState().sessions.find((candidate) => candidate.id === other.id)?.goal).toBe(
      other.goal,
    );
  });
  it('keeps later edits when Undo would overwrite them', async () => {
    await applyGoalFromWork(next);
    await store.getState().upsertSessionSlot(session.id, 'goal', 'Reconcile the Northwind export.');
    expect(await store.getState().undoLastOperation({})).toBe(false);
    expect(await values()).toEqual({ title: next.title, goal: 'Reconcile the Northwind export.' });
  });
  it('keeps both old values on a failed title write and allows retry', async () => {
    injectDbFault({ match: /UPDATE sessions SET goal/ });
    await expect(applyGoalFromWork(next)).rejects.toThrow();
    expect(await values()).toEqual({ title: session.goal, goal: originalGoal });
    expect(store.getState().undoStack).toHaveLength(0);
    await applyGoalFromWork(next);
    expect(await values()).toEqual({ title: next.title, goal: next.goal });
  });
  it('compensates a partial save and retries without a partial Undo entry', async () => {
    injectDbFault({ match: /INSERT INTO context_slots/ });
    await expect(applyGoalFromWork(next)).rejects.toThrow();
    expect(await values()).toEqual({ title: session.goal, goal: originalGoal });
    expect(store.getState().undoStack).toHaveLength(0);
    await applyGoalFromWork(next);
    expect(store.getState().undoStack).toHaveLength(1);
  });
  it('restores values even when the goal landed before its history read failed', async () => {
    injectDbFault({
      match: /FROM context_slot_history/,
    });
    await expect(applyGoalFromWork(next)).rejects.toThrow();
    expect(await values()).toEqual({ title: session.goal, goal: originalGoal });
    await applyGoalFromWork(next);
    expect(await values()).toEqual({ title: next.title, goal: next.goal });
  });
  it('leaves a failed partial Undo retryable after compensation', async () => {
    await applyGoalFromWork(next);
    injectDbFault({ match: /INSERT INTO context_slots/ });
    expect(await store.getState().undoLastOperation({})).toBe(false);
    expect(await values()).toEqual({ title: next.title, goal: next.goal });
    expect(store.getState().undoStack).toHaveLength(1);
    expect(await store.getState().undoLastOperation({})).toBe(true);
    expect(await values()).toEqual({ title: session.goal, goal: originalGoal });
  });
});
