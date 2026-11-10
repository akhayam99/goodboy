// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';
import { nextSessionId } from '@goodboy/types/testing';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../storyHarness';
import type { StoryStore } from '../../storyHarness';
import { selectDrawerPanel } from './selectDrawerPanel';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../storyHarness')).tauriEventModuleMock(),
);

const SESSION_ID: SessionId = nextSessionId();

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  store.setState({ currentSessionId: SESSION_ID });
});

const shownKind = (): string | null => selectDrawerPanel(store.getState())?.kind ?? null;

describe('toggleDrawer', () => {
  it('closes a shown drawer on a session', () => {
    store.getState().toggleDrawer({ kind: 'explore', sessionId: SESSION_ID, payload: null });
    expect(shownKind()).toBe('explore');

    store.getState().toggleDrawer({ kind: 'explore', sessionId: SESSION_ID, payload: null });

    expect(shownKind()).toBeNull();
  });

  it('closes the page and shows the drawer parked under it', () => {
    store.getState().toggleDrawer({ kind: 'explore', sessionId: SESSION_ID, payload: null });
    store.getState().openStudio({ studio: { kind: 'inbox', focus: null } });
    expect(shownKind()).toBeNull();

    store.getState().toggleDrawer({ kind: 'explore', sessionId: SESSION_ID, payload: null });

    expect(store.getState().appStudio).toBeNull();
    expect(shownKind()).toBe('explore');
  });

  it('closes the page and opens the drawer when nothing was parked', () => {
    store.getState().openStudio({ studio: { kind: 'inbox', focus: null } });

    store.getState().toggleDrawer({ kind: 'explore', sessionId: SESSION_ID, payload: null });

    expect(store.getState().appStudio).toBeNull();
    expect(shownKind()).toBe('explore');
  });
});
