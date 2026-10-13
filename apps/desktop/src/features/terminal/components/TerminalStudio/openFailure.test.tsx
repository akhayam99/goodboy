// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { IsoDateTime, Session, SessionId, WorkspaceId } from '@goodboy/types';
import type { TerminalTab, TerminalTabId } from '../../../../shared/types/terminal';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/components/GenericTerminalPanel/LazyGenericTerminalPanel', () => ({
  LazyGenericTerminalPanel: () => <div data-testid="terminal-panel" />,
}));

import { TerminalStudio } from './index';
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
let openCalls = 0;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  openCalls = 0;
  stubStoryInvoke({
    terminal_open: () => {
      openCalls += 1;
      throw new Error('spawn /bin/zsh ENOENT');
    },
    terminal_list_live: [],
    terminal_close: null,
    db_execute: { rowsAffected: 0 },
    db_select: [],
    monitor_snapshot: { listeners: [], processes: [], takenAt: 0, isPlatformSupported: true },
    process_ledger_list: [],
    monitor_watched_ports: [],
  });
  store.setState({
    sessions: [SESSION],
    terminalTabs: { [SESSION_ID]: [TAB] },
    activeTerminalTab: { [SESSION_ID]: TAB_ID },
  });
});

afterEach(() => {
  cleanup();
});

describe('a terminal that fails to open', () => {
  it('reports the failure on the pane and moves the tab to exited', async () => {
    render(
      <TerminalStudio
        workspaceId={WORKSPACE_ID}
        terminalId={TAB_ID}
        sessionId={SESSION_ID}
        onClose={() => undefined}
      />,
    );

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain("Couldn't open this terminal");
    expect(alert.textContent).toContain('spawn /bin/zsh ENOENT');
    const tab = store.getState().terminalTabs[SESSION_ID]?.[0];
    expect(tab?.status).toBe('exited');
    expect(tab?.openError).toBe('spawn /bin/zsh ENOENT');
    expect(await screen.findByText('failed to open')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Restart' })).toBeDefined();
  });

  it('never opens a failed tab again when its pane mounts a second time', async () => {
    const first = render(
      <TerminalStudio
        workspaceId={WORKSPACE_ID}
        terminalId={TAB_ID}
        sessionId={SESSION_ID}
        onClose={() => undefined}
      />,
    );
    await screen.findByRole('alert');
    expect(openCalls).toBe(1);
    first.unmount();

    render(
      <TerminalStudio
        workspaceId={WORKSPACE_ID}
        terminalId={TAB_ID}
        sessionId={SESSION_ID}
        onClose={() => undefined}
      />,
    );

    await screen.findByRole('alert');
    expect(openCalls).toBe(1);
  });

  it('retries into a fresh terminal when Restart is pressed', async () => {
    render(
      <TerminalStudio
        workspaceId={WORKSPACE_ID}
        terminalId={TAB_ID}
        sessionId={SESSION_ID}
        onClose={() => undefined}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Restart' }));

    await waitFor(() => expect(openCalls).toBe(2));
    const tabs = store.getState().terminalTabs[SESSION_ID] ?? [];
    expect(tabs).toHaveLength(1);
    expect(tabs[0]?.id).not.toBe(TAB_ID);
  });
});
