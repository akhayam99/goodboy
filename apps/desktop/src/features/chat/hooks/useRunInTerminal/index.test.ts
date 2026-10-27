// @vitest-environment happy-dom

import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { nextSessionId, nextWorkspaceId } from '@goodboy/types/testing';
import {
  STORE_IMPORT_TIMEOUT_MS,
  STORY_NOW,
  buildStorySession,
  importStore,
  resetStoryStore,
  storySpies,
  type StoryStore,
} from '../../../../store/storyHarness';
import { useRunInTerminal } from '.';

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../../store/storyHarness')).tauriEventModuleMock(),
);
vi.mock('../../../../shared/lib/db', async () =>
  (await import('../../../../store/storyHarness')).sqliteDbLibModuleMock(),
);

const WORKSPACE_ID = nextWorkspaceId();
const SESSION_ID = nextSessionId();
const PASTE_START = '\u001B[200~';
const PASTE_END = '\u001B[201~';

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  useAppStore.setState({
    sessions: [buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID })],
    currentSessionId: SESSION_ID,
    sessionWorktrees: { [SESSION_ID]: ['/wt/ledger-core'] },
  });
});

afterEach(cleanup);

const tabsOf = () => useAppStore.getState().terminalTabs[SESSION_ID] ?? [];

describe('useRunInTerminal', () => {
  it('types the command in a new terminal at the given folder and opens the drawer', () => {
    const { result } = renderHook(() => useRunInTerminal({ sessionId: SESSION_ID }));

    expect(result.current.canRun).toBe(true);
    result.current.run({ command: 'pnpm migrate:up', cwd: '/wt/payments-api' });

    expect(tabsOf()).toHaveLength(1);
    expect(tabsOf()[0]?.cwd).toBe('/wt/payments-api');
    expect(tabsOf()[0]?.prefill).toBe('pnpm migrate:up');
    expect(useAppStore.getState().drawer).toEqual({
      kind: 'terminal',
      sessionId: SESSION_ID,
      payload: { terminalId: tabsOf()[0]?.id },
    });
  });

  it('never presses Enter: the typed text has no line end, even when the command ends with one', () => {
    const { result } = renderHook(() => useRunInTerminal({ sessionId: SESSION_ID }));

    result.current.run({ command: 'pnpm migrate:up\n', cwd: null });

    const typed = tabsOf()[0]?.prefill ?? '';
    expect(typed).toBe('pnpm migrate:up');
    expect(typed).not.toMatch(/[\r\n]/);
    expect(storySpies.tauriInvoke).not.toHaveBeenCalledWith('terminal_write', expect.anything());
  });

  it('types several lines as one paste so none of them runs by itself', () => {
    const { result } = renderHook(() => useRunInTerminal({ sessionId: SESSION_ID }));

    result.current.run({ command: 'cd ledger-core\npnpm test\n', cwd: null });

    expect(tabsOf()[0]?.prefill).toBe(`${PASTE_START}cd ledger-core\npnpm test${PASTE_END}`);
  });

  it('falls back to the session worktree when no folder is given', () => {
    const { result } = renderHook(() => useRunInTerminal({ sessionId: SESSION_ID }));

    result.current.run({ command: 'pnpm test', cwd: null });

    expect(tabsOf()[0]?.cwd).toBe('/wt/ledger-core');
  });

  it('types nothing for an empty command', () => {
    const { result } = renderHook(() => useRunInTerminal({ sessionId: SESSION_ID }));

    result.current.run({ command: ' \n ', cwd: null });

    expect(tabsOf()).toHaveLength(0);
    expect(useAppStore.getState().drawer).toBeNull();
  });

  it('hides the verb in an archived session and does nothing when called', () => {
    useAppStore.setState({
      sessions: [
        buildStorySession({ id: SESSION_ID, workspaceId: WORKSPACE_ID, archivedAt: STORY_NOW }),
      ],
    });
    const { result } = renderHook(() => useRunInTerminal({ sessionId: SESSION_ID }));

    expect(result.current.canRun).toBe(false);
    result.current.run({ command: 'pnpm test', cwd: null });

    expect(tabsOf()).toHaveLength(0);
  });

  it('hides the verb without a session', () => {
    const { result } = renderHook(() => useRunInTerminal({ sessionId: null }));

    expect(result.current.canRun).toBe(false);
  });
});
