// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { IsoDateTime, Session, SessionId, WorkspaceId } from '@goodboy/types';
import type { TerminalTab, TerminalTabId } from '../../../../shared/types/terminal';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';

type PlatformState = {
  current: 'darwin' | 'win32';
};

const { platform } = vi.hoisted((): { readonly platform: PlatformState } => ({
  platform: { current: 'darwin' },
}));

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/platform', () => ({ currentPlatform: () => platform.current }));
vi.mock('../../../../shared/components/GenericTerminalPanel/LazyGenericTerminalPanel', () => ({
  LazyGenericTerminalPanel: () => <div data-testid="terminal-panel" />,
}));

import { SessionTerminalLens } from './SessionTerminalLens';
import { brandedId } from '../../../../features/history/testing/brandedId';

const NOW = brandedId<IsoDateTime>({ value: '2026-10-10T09:12:00.000Z' });
const WORKSPACE_ID = brandedId<WorkspaceId>({ value: 'workspace-1' });
const SESSION_ID = brandedId<SessionId>({ value: 'session-1' });
const TAB_ID = brandedId<TerminalTabId>({ value: `${SESSION_ID}::t1` });

const SESSION: Session = {
  id: SESSION_ID,
  workspaceId: WORKSPACE_ID,
  goal: 'Round settlement totals to minor units',
  state: { kind: 'idle', lastActivityAt: NOW },
  contextSlots: [],
  providerPreference: { defaultProvider: 'anthropic', allowTurnOverride: true },
  permissionMode: 'default',
  workflowRuns: [],
  autoRun: false,
  titleUserEdited: true,
  createdAt: NOW,
  updatedAt: NOW,
};

const TAB: TerminalTab = {
  id: TAB_ID,
  owner: { kind: 'session', sessionId: SESSION_ID },
  title: 'payments-api',
  cwd: '/repo',
  status: 'running',
  createdAt: 0,
};

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ terminal_open: null, terminal_list_live: [], db_select: [] });
  store.setState({
    sessions: [SESSION],
    terminalTabs: { [SESSION_ID]: [TAB] },
    activeTerminalTab: { [SESSION_ID]: TAB_ID },
  });
});

afterEach(() => {
  cleanup();
  platform.current = 'darwin';
});

const mountLens = (): HTMLElement => {
  render(
    <SessionTerminalLens
      workspaceId={WORKSPACE_ID}
      sessionId={SESSION_ID}
      isActive
      sessionCwd="/repo"
    />,
  );
  return screen.getByTestId('terminal-panel');
};

const tabCount = (): number => store.getState().terminalTabs[SESSION_ID]?.length ?? 0;

describe('the session terminal new terminal shortcut', () => {
  it('opens a terminal in the session folder on the command combo on darwin', () => {
    const target = mountLens();

    fireEvent.keyDown(target, { code: 'KeyT', metaKey: true });

    expect(tabCount()).toBe(2);
    expect(store.getState().terminalTabs[SESSION_ID]?.[1]?.cwd).toBe('/repo');
  });

  it('leaves the control combos to the pty on darwin', () => {
    const target = mountLens();

    fireEvent.keyDown(target, { code: 'KeyT', ctrlKey: true });
    fireEvent.keyDown(target, { code: 'KeyT', ctrlKey: true, shiftKey: true });

    expect(tabCount()).toBe(1);
  });

  it('opens a terminal on control shift off darwin', () => {
    platform.current = 'win32';
    const target = mountLens();

    fireEvent.keyDown(target, { code: 'KeyT', ctrlKey: true, shiftKey: true });

    expect(tabCount()).toBe(2);
  });

  it('leaves plain control to the pty off darwin', () => {
    platform.current = 'win32';
    const target = mountLens();

    fireEvent.keyDown(target, { code: 'KeyT', ctrlKey: true });

    expect(tabCount()).toBe(1);
  });

  it('shows the session rows by name, with no Terminal 2 label', () => {
    mountLens();

    expect(screen.getByRole('button', { name: 'payments-api' })).toBeDefined();
    expect(screen.queryByText(/^Terminal \d+$/)).toBeNull();
  });
});
