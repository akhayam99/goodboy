// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { aProject, aSession } from '@goodboy/types/testing';
import { brandId, type MountId, type SessionProjectMount } from '@goodboy/types';
import type { TerminalTab, TerminalTabId } from '../../../../shared/types/terminal';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  storySpies,
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

const SESSION = aSession();
const PROJECT = aProject({ workspaceId: SESSION.workspaceId, name: 'payments-api' });
const MOUNT_ID = brandId<MountId>({ value: 'mount-payments-api' });
const TAB_ID = brandId<TerminalTabId>({ value: `${SESSION.id}::t1` });

const MOUNT: SessionProjectMount = {
  mountId: MOUNT_ID,
  sessionId: SESSION.id,
  projectId: PROJECT.id,
  mountName: 'payments-api',
  worktreePath: '/worktrees/payments-api',
  lastWorktreePath: '/worktrees/payments-api',
  repoRoot: '/repos/payments-api',
  branch: 'hl/fix-credit',
  baseBranch: 'main',
  parallelIndex: 0,
  isAttached: true,
  diskState: 'present',
  revision: 1,
};

const TAB: TerminalTab = {
  id: TAB_ID,
  owner: { kind: 'session', sessionId: SESSION.id },
  title: 'payments-api',
  cwd: '/worktrees/payments-api',
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
    terminal_write: null,
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
    projects: [PROJECT],
    sessionProjectMounts: { [SESSION.id]: [MOUNT] },
    sessionActiveMount: { [SESSION.id]: MOUNT_ID },
    terminalTabs: { [SESSION.id]: [TAB] },
    activeTerminalTab: { [SESSION.id]: TAB_ID },
  });
});

afterEach(cleanup);

const show = () =>
  render(
    <TerminalStudio
      workspaceId={SESSION.workspaceId}
      terminalId={TAB_ID}
      sessionId={SESSION.id}
      onClose={() => undefined}
    />,
  );

const writesOf = () =>
  storySpies.tauriInvoke.mock.calls
    .filter(([command]) => command === 'terminal_write')
    .map(([, args]) => args);

describe('Change folder in a terminal', () => {
  it('clears a half-typed command before it types the cd, so nothing is glued to it', async () => {
    show();

    fireEvent.click(
      await screen.findByRole('combobox', { name: 'Change directory in this terminal' }),
    );
    fireEvent.click(await screen.findByText('Main checkout'));

    await waitFor(() => expect(writesOf()).toHaveLength(1));
    expect(writesOf()[0]).toEqual({
      sessionId: TAB_ID,
      data: btoa("\x05\x15cd '/repos/payments-api'\r"),
    });
  });

  it('says in the picker that the shell is told to cd and the tab keeps its group', async () => {
    show();

    fireEvent.click(
      await screen.findByRole('combobox', { name: 'Change directory in this terminal' }),
    );

    await screen.findByRole('listbox');
    screen.getByText(/stays under the folder it started in/);
  });
});
