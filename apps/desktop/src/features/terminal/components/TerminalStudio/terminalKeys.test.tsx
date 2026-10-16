// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type {
  IsoDateTime,
  MountId,
  ProjectId,
  Session,
  SessionId,
  SessionProjectMount,
  WorkspaceId,
} from '@goodboy/types';
import type { TerminalTab, TerminalTabId } from '../../../../shared/types/terminal';
import { registerShortcut } from '../../../../shared/keyboard/dispatcher';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../../store/storyHarness';
import { brandedId } from '../../../history/testing/brandedId';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/platform', () => ({ currentPlatform: () => 'darwin' }));
vi.mock('../../../../shared/components/GenericTerminalPanel/LazyGenericTerminalPanel', () => ({
  LazyGenericTerminalPanel: () => <div data-testid="terminal-panel" />,
}));

import { TerminalDrawerBody } from '../TerminalDrawer/TerminalDrawerBody';
import { TerminalStudio } from './index';

const NOW = brandedId<IsoDateTime>({ value: '2026-10-10T09:12:00.000Z' });
const WORKSPACE_ID = brandedId<WorkspaceId>({ value: 'workspace-1' });
const SESSION_ID = brandedId<SessionId>({ value: 'session-1' });
const MOUNT_ID = brandedId<MountId>({ value: 'mount-1' });
const TAB_ID = brandedId<TerminalTabId>({ value: `${SESSION_ID}::t1` });
const WORKTREE_KEY = `${SESSION_ID}#m:${MOUNT_ID}`;

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

const MOUNT: SessionProjectMount = {
  mountId: MOUNT_ID,
  sessionId: SESSION_ID,
  projectId: brandedId<ProjectId>({ value: 'project-1' }),
  mountName: 'payments-api',
  worktreePath: '/work/payments-api',
  lastWorktreePath: null,
  repoRoot: '/work/payments-api',
  branch: 'mara/ledger-export',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

const TAB: TerminalTab = {
  id: TAB_ID,
  owner: { kind: 'session', sessionId: SESSION_ID },
  title: 'payments-api',
  cwd: MOUNT.worktreePath,
  status: 'running',
  createdAt: 0,
};

let store: StoryStore;

beforeAll(async () => {
  store = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({
    terminal_open: null,
    terminal_close: null,
    terminal_list_live: [],
    db_select: [],
    monitor_snapshot: { listeners: [], processes: [], takenAt: 0, isPlatformSupported: true },
    process_ledger_list: [],
    monitor_watched_ports: [],
  });
  store.setState({
    currentWorkspaceId: WORKSPACE_ID,
    currentSessionId: SESSION_ID,
    sessions: [SESSION],
    sessionProjectMounts: { [SESSION_ID]: [MOUNT] },
    terminalFolderOverrides: { [WORKSPACE_ID]: '/work' },
    terminalTabs: { [SESSION_ID]: [TAB] },
    activeTerminalTab: { [SESSION_ID]: TAB_ID },
  });
});

afterEach(cleanup);

const tabCount = (): number => store.getState().terminalTabs[SESSION_ID]?.length ?? 0;

const mountPage = (): void => {
  render(
    <TerminalStudio
      workspaceId={WORKSPACE_ID}
      terminalId={TAB_ID}
      sessionId={SESSION_ID}
      onClose={() => undefined}
    />,
  );
};

const mountDrawer = (): HTMLElement => {
  render(
    <TerminalDrawerBody
      workspaceId={WORKSPACE_ID}
      sessionId={SESSION_ID}
      worktreeKey={WORKTREE_KEY}
      onClose={() => undefined}
    />,
  );
  return screen.getByTestId('terminal-panel');
};

describe('cmd+n on the Terminal page', () => {
  it('opens the keyboard picker and never starts a session or a tab', () => {
    mountPage();
    const newSession = vi.fn();
    const stop = registerShortcut('session.new', newSession);

    fireEvent.keyDown(document.body, { code: 'KeyN', metaKey: true });
    stop();

    expect(screen.getByRole('searchbox', { name: 'Filter terminal locations' })).toBeDefined();
    expect(tabCount()).toBe(1);
    expect(newSession).not.toHaveBeenCalled();
  });

  it('opens a tab on the chosen row when Enter is pressed', () => {
    mountPage();

    fireEvent.keyDown(document.body, { code: 'KeyN', metaKey: true });
    fireEvent.keyDown(screen.getByRole('searchbox', { name: 'Filter terminal locations' }), {
      key: 'Enter',
    });

    const tabs = store.getState().terminalTabs;
    const cwds = Object.values(tabs)
      .flat()
      .map((tab) => tab.cwd);
    expect(cwds).toContain('/work');
  });

  it('opens a tab without a picker on cmd+t', () => {
    mountPage();

    fireEvent.keyDown(screen.getByTestId('terminal-panel'), { code: 'KeyT', metaKey: true });

    expect(screen.queryByRole('searchbox', { name: 'Filter terminal locations' })).toBeNull();
    expect(tabCount()).toBe(2);
  });
});

describe('the terminal keys inside the session drawer', () => {
  it('opens a tab in the drawer on cmd+t without a picker', () => {
    const target = mountDrawer();

    fireEvent.keyDown(target, { code: 'KeyT', metaKey: true });

    expect(tabCount()).toBe(2);
    expect(screen.queryByRole('combobox', { name: 'Search' })).toBeNull();
  });

  it('closes the last tab on cmd+w and then the drawer', () => {
    const onClose = vi.fn();
    render(
      <TerminalDrawerBody
        workspaceId={WORKSPACE_ID}
        sessionId={SESSION_ID}
        worktreeKey={WORKTREE_KEY}
        onClose={onClose}
      />,
    );

    fireEvent.keyDown(window, { code: 'KeyW', metaKey: true });

    expect(tabCount()).toBe(0);
    expect(onClose).toHaveBeenCalled();
  });

  it('opens the picker on cmd+n and never starts a session', () => {
    mountDrawer();
    const newSession = vi.fn();
    const stop = registerShortcut('session.new', newSession);

    fireEvent.keyDown(document.body, { code: 'KeyN', metaKey: true });
    stop();

    expect(screen.getByRole('combobox', { name: 'Search' })).toBeDefined();
    expect(newSession).not.toHaveBeenCalled();
    expect(tabCount()).toBe(1);
  });

  it('opens a fresh tab in the drawer on the workspace folder from the picker', () => {
    mountDrawer();

    fireEvent.keyDown(document.body, { code: 'KeyN', metaKey: true });
    fireEvent.click(screen.getByRole('option', { name: /Workspace folder/ }));

    const tabs = store.getState().terminalTabs[SESSION_ID] ?? [];
    expect(tabs).toHaveLength(2);
    expect(tabs[1]?.cwd).toBe('/work');
    expect(store.getState().drawer?.kind).toBe('terminal');
  });
});
