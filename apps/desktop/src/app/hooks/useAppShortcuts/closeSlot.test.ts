// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';
import { nextSessionId } from '@goodboy/types/testing';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../../store/storyHarness';
import type { StoryStore } from '../../../store/storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { closeSlot } from './closeSlot';

const SESSION_ID: SessionId = nextSessionId();

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  store.setState({ currentSessionId: SESSION_ID });
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('closeSlot', () => {
  it('closes the top of the slot and brings the chip back', () => {
    store.getState().openDrawer({ kind: 'explore', sessionId: SESSION_ID, payload: null });
    store.getState().openDrawer({ kind: 'ask', sessionId: SESSION_ID, payload: null });

    closeSlot({});

    expect(store.getState().drawer?.kind).toBe('explore');
    expect(store.getState().drawerBack).toBeNull();
  });

  it('leaves the drawer alone while a dialog is open over it', () => {
    store.getState().openDrawer({ kind: 'ask', sessionId: SESSION_ID, payload: null });
    document.body.innerHTML = '<div role="dialog"></div>';

    closeSlot({});

    expect(store.getState().drawer?.kind).toBe('ask');
  });
});
