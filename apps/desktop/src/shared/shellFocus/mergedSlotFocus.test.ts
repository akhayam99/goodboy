// @vitest-environment happy-dom

import { brandId } from '@goodboy/types';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionId } from '@goodboy/types';
import { aSession } from '@goodboy/types/testing';
import type { TerminalTabId } from '../types/terminal';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  type StoryStore,
} from '../../store/storyHarness';
import { gridWithLayout } from '../../store/slices/drawer/dockTabs/gridWithLayout';
import { panelFocusKeyOf } from '../../store/slices/drawer/panelFocusKeyOf';
import { shellPanelsOf } from '../../store/slices/drawer/shellPanelsOf';
import type { DrawerRequest } from '../../store/slices/drawer/state';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('@goodboy/db', async () => (await import('../../store/storyHarness')).dbModuleMock());
vi.mock('../lib/db', async () => (await import('../../store/storyHarness')).dbLibModuleMock());

import { focusShellPanel } from './focusShellPanel';

const SESSION_ID = brandId<SessionId>({ value: 'session-harborline' });

const TERMINAL: DrawerRequest = {
  kind: 'terminal',
  sessionId: null,
  payload: { terminalId: brandId<TerminalTabId>({ value: 'term-harborline' }) },
};
const BROWSER: DrawerRequest = { kind: 'browser', sessionId: null, payload: null };

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  store.setState({ sessions: [aSession({ id: SESSION_ID })], currentSessionId: SESSION_ID });
});

const focusKey = (): string =>
  panelFocusKeyOf({ panels: shellPanelsOf({ state: store.getState() }) });

describe('a merged dock slot', () => {
  it('moves the focus between its tools in both directions', () => {
    store.getState().openDrawer(TERMINAL);
    store.getState().openDrawer(BROWSER);
    store.setState({
      drawerGrid: gridWithLayout({
        grid: store.getState().drawerGrid,
        layout: {
          columns: [['terminal']],
          groups: { terminal: ['terminal', 'browser'] },
        },
        active: 'browser',
      }),
    });
    expect(focusKey()).toBe('browser');

    focusShellPanel({ key: 'terminal' });
    expect(focusKey()).toBe('terminal');

    focusShellPanel({ key: 'browser' });
    expect(focusKey()).toBe('browser');
  });
});
