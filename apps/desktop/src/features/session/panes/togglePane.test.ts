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

import { openBranchTerminal } from '../../terminal/openBranchTerminal';
import { togglePane } from './togglePane';

vi.mock('../../terminal/openBranchTerminal', () => ({ openBranchTerminal: vi.fn() }));

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

describe('togglePane', () => {
  it('opens the branch terminal for the Scripts chord, and leaves the page it was pressed on', () => {
    store.getState().openStudio({ studio: { kind: 'impact', scope: null } });

    togglePane({ sessionId: SESSION_ID, pane: 'scripts' });

    expect(store.getState().appStudio).toBeNull();
    expect(openBranchTerminal).toHaveBeenCalledWith({ sessionId: SESSION_ID, mountPath: null });
  });

  it('keeps a panel of the grid beside a page that is not its own', () => {
    store.getState().openDrawer({ kind: 'scripts', sessionId: SESSION_ID, payload: null });
    store.getState().openStudio({ studio: { kind: 'impact', scope: null } });

    expect(shownKind()).toBe('scripts');
    expect(store.getState().appStudio?.kind).toBe('impact');
  });

  it('toggles Monitor in the dock', () => {
    togglePane({ sessionId: SESSION_ID, pane: 'monitoring' });
    expect(shownKind()).toBe('monitoring');

    togglePane({ sessionId: SESSION_ID, pane: 'monitoring' });
    expect(shownKind()).toBeNull();
  });
});
