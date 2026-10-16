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

import { closeCurrentLevel } from './closeCurrentLevel';

const SESSION_ID: SessionId = nextSessionId();

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('closeCurrentLevel', () => {
  it('closes the open drawer of the current session', () => {
    store.setState({ currentSessionId: SESSION_ID });
    store.getState().openDrawer({ kind: 'ask', sessionId: SESSION_ID, payload: null });

    closeCurrentLevel({});

    expect(store.getState().drawer).toBeNull();
  });

  it('closes an open popover first and keeps the drawer', () => {
    store.setState({ currentSessionId: SESSION_ID });
    store.getState().openDrawer({ kind: 'ask', sessionId: SESSION_ID, payload: null });
    document.body.innerHTML = '<div role="dialog"></div>';

    closeCurrentLevel({});

    expect(store.getState().drawer?.kind).toBe('ask');
  });

  it('closes a studio that covers the page', () => {
    store.getState().openStudio({ studio: { kind: 'monitoring' } });

    closeCurrentLevel({});

    expect(store.getState().appStudio).toBeNull();
  });

  it('does nothing on the Sessions page', () => {
    const before = store.getState().currentSessionId;

    closeCurrentLevel({});

    expect(store.getState().currentSessionId).toBe(before);
    expect(store.getState().appStudio).toBeNull();
  });
});
