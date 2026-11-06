// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandId, type IsoDateTime, type SessionId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import { importStore, resetStoryStore, type StoryStore } from '../../storyHarness';

const h = vi.hoisted(() => ({ persistRead: vi.fn(async () => undefined) }));
vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () =>
  (await import('../../storyHarness')).dbModuleMock({ setSessionContextSeenAt: h.persistRead }),
);

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });
const BEFORE = brandId<IsoDateTime>({ value: '2026-11-01T09:00:00.000Z' });
const AFTER = brandId<IsoDateTime>({ value: '2026-11-01T10:00:00.000Z' });
const LATER = brandId<IsoDateTime>({ value: '2026-11-01T11:00:00.000Z' });
let store: StoryStore;
beforeAll(async () => {
  store = await importStore();
});
beforeEach(async () => {
  await resetStoryStore();
  h.persistRead.mockReset();
  h.persistRead.mockResolvedValue(undefined);
  store.setState({
    sessions: [aSession({ id: SESSION_ID })],
    currentSessionId: SESSION_ID,
    sessionContextSeenAt: { [SESSION_ID]: BEFORE },
    sessionDecisionsBaseline: { [SESSION_ID]: BEFORE },
  });
});

describe('Context drawer state', () => {
  it('opens on Goal each time, while explicit section links and versions keep their target', () => {
    store
      .getState()
      .openContextDrawer({ sessionId: SESSION_ID, section: 'summary', view: 'versions' });
    expect(store.getState().drawer).toMatchObject({
      payload: { section: 'summary', view: 'versions' },
    });
    store.getState().closeDrawer();
    store.getState().openContextDrawer({ sessionId: SESSION_ID });
    expect(store.getState().drawer).toMatchObject({
      payload: { section: 'goal', view: 'current' },
    });
    store.getState().toggleContextDrawer({ sessionId: SESSION_ID });
    expect(store.getState().drawer).toBeNull();
    store
      .getState()
      .openContextDrawer({ sessionId: SESSION_ID, section: 'decisions', highlight: [5, 7] });
    expect(store.getState().drawer).toMatchObject({
      payload: { section: 'decisions', highlight: [5, 7] },
    });
  });

  it('keeps the old marker while saving and moves seen and baseline after success', async () => {
    let finish: () => void = () => undefined;
    h.persistRead.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          finish = () => resolve(undefined);
        }),
    );
    const saving = store.getState().markContextRead({ sessionId: SESSION_ID, readAt: AFTER });
    expect(store.getState().sessionDecisionsBaseline[SESSION_ID]).toBe(BEFORE);
    finish();
    await saving;
    expect(store.getState().sessionDecisionsBaseline[SESSION_ID]).toBe(AFTER);
    expect(store.getState().sessionContextSeenAt[SESSION_ID]).toBe(AFTER);
  });

  it('keeps the old marker after failure and succeeds on retry', async () => {
    h.persistRead.mockRejectedValueOnce(new Error('disk full'));
    await expect(
      store.getState().markContextRead({ sessionId: SESSION_ID, readAt: AFTER }),
    ).rejects.toThrow('disk full');
    expect(store.getState().sessionDecisionsBaseline[SESSION_ID]).toBe(BEFORE);
    await store.getState().markContextRead({ sessionId: SESSION_ID, readAt: AFTER });
    expect(store.getState().sessionDecisionsBaseline[SESSION_ID]).toBe(AFTER);
  });

  it('drops an older read result that arrives after a newer one', async () => {
    let finish: () => void = () => undefined;
    h.persistRead.mockImplementationOnce(
      () =>
        new Promise<undefined>((resolve) => {
          finish = () => resolve(undefined);
        }),
    );
    const earlier = store.getState().markContextRead({ sessionId: SESSION_ID, readAt: AFTER });
    await store.getState().markContextRead({ sessionId: SESSION_ID, readAt: LATER });
    finish();
    await earlier;
    expect(store.getState().sessionDecisionsBaseline[SESSION_ID]).toBe(LATER);
    expect(store.getState().sessionContextSeenAt[SESSION_ID]).toBe(LATER);
  });
});
