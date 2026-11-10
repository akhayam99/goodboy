// @vitest-environment happy-dom

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';
import { nextSessionId } from '@goodboy/types/testing';
import { selectDrawerPanel } from '../../../store/slices/drawer/selectDrawerPanel';
import { STORE_IMPORT_TIMEOUT_MS, importStore, resetStoryStore } from '../../../store/storyHarness';
import type { StoryStore } from '../../../store/storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import { togglePane } from './togglePane';

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

describe('togglePane under a page', () => {
  it('closes the page and shows the parked pane instead of closing it unseen', () => {
    togglePane({ sessionId: SESSION_ID, pane: 'context' });
    store.getState().openStudio({ studio: { kind: 'impact', scope: null } });
    expect(shownKind()).toBeNull();

    togglePane({ sessionId: SESSION_ID, pane: 'context' });

    expect(store.getState().appStudio).toBeNull();
    expect(shownKind()).toBe('context');
  });

  it('leaves Impact opened from Guide in one press and shows the parked pane', () => {
    togglePane({ sessionId: SESSION_ID, pane: 'context' });
    store.getState().openStudio({ studio: { kind: 'guide' } });
    store.getState().openStudio({ studio: { kind: 'impact', scope: null } });

    togglePane({ sessionId: SESSION_ID, pane: 'context' });

    expect(store.getState().appStudio).toBeNull();
    expect(shownKind()).toBe('context');
  });

  it('closes the page and opens the pane when nothing was parked', () => {
    store.getState().openStudio({ studio: { kind: 'impact', scope: null } });

    togglePane({ sessionId: SESSION_ID, pane: 'context' });

    expect(store.getState().appStudio).toBeNull();
    expect(shownKind()).toBe('context');
  });

  it('still closes a shown pane on a session', () => {
    togglePane({ sessionId: SESSION_ID, pane: 'context' });
    expect(shownKind()).toBe('context');

    togglePane({ sessionId: SESSION_ID, pane: 'context' });

    expect(shownKind()).toBeNull();
  });
});
