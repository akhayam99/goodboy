// @vitest-environment happy-dom

vi.mock('@tauri-apps/api/core', async () =>
  (await import('../../../store/storyHarness')).tauriCoreModuleMock(),
);
vi.mock('@tauri-apps/api/event', async () =>
  (await import('../../../store/storyHarness')).tauriEventModuleMock(),
);

import type { ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { aSession, aWorkspace } from '@goodboy/types/testing';
import type {
  ChatId,
  ChatMessageId,
  IsoDateTime,
  ProviderId,
  ProviderRunId,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { brandedId } from '../../history/testing/brandedId';
import { ToastProvider } from '../../../shared/components/Toast';
import {
  STORE_IMPORT_TIMEOUT_MS,
  importStore,
  resetStoryStore,
  stubStoryInvoke,
  type StoryStore,
} from '../../../store/storyHarness';
import { ASK_RESET_EVENT } from '../../session/ask/ASK_RESET_EVENT';
import { useCommandEntries } from './useCommandEntries';

const WORKSPACE_ID = brandedId<WorkspaceId>({ value: 'workspace-harborline' });
const SESSION_ID = brandedId<SessionId>({ value: 'session-ledger-core' });
const THREAD_ID = brandedId<ChatId>({ value: 'thread-1' });

let useAppStore: StoryStore;

beforeAll(async () => {
  useAppStore = await importStore();
}, STORE_IMPORT_TIMEOUT_MS);

beforeEach(async () => {
  await resetStoryStore();
  stubStoryInvoke({ db_select: [] });
  useAppStore.setState({
    workspaces: [aWorkspace({ id: WORKSPACE_ID, name: 'Harborline' })],
    currentWorkspaceId: WORKSPACE_ID,
    sessions: [aSession({ id: SESSION_ID, workspaceId: WORKSPACE_ID, goal: 'Round totals' })],
    currentSessionId: SESSION_ID,
  });
});

afterEach(cleanup);

const wrapper = ({ children }: { readonly children: ReactNode }) => (
  <ToastProvider>{children}</ToastProvider>
);

const entryKeys = (): ReadonlyArray<string> => {
  const { result } = renderHook(() => useCommandEntries(), { wrapper });
  return result.current.map((entry) => entry.key);
};

describe('the palette entries for new things', () => {
  it('lists New session, New chat and New terminal so Cmd+K reaches every new', () => {
    const keys = entryKeys();

    expect(keys).toContain('action:new-session');
    expect(keys).toContain('action:new-chat');
    expect(keys).toContain('action:new-terminal');
  });

  it('lists Reset chat only while Ask is open for the session', () => {
    expect(entryKeys()).not.toContain('action:ask-reset');

    act(() => {
      useAppStore.getState().openDrawer({ kind: 'ask', sessionId: SESSION_ID, payload: null });
    });

    expect(entryKeys()).toContain('action:ask-reset');
  });

  it('omits Reset chat while Ask is streaming', () => {
    act(() => {
      useAppStore.getState().openDrawer({ kind: 'ask', sessionId: SESSION_ID, payload: null });
      useAppStore.setState({
        askThreads: {
          [SESSION_ID]: [
            {
              id: THREAD_ID,
              workspaceId: WORKSPACE_ID,
              sessionId: SESSION_ID,
              title: 'What needs me?',
              provider: brandedId<ProviderId>({ value: 'claude' }),
              model: 'claude-sonnet-5-5',
              effort: null,
              lastActivityAt: brandedId<IsoDateTime>({ value: '2026-10-13T09:00:00.000Z' }),
              createdAt: brandedId<IsoDateTime>({ value: '2026-10-13T09:00:00.000Z' }),
              messageCount: 1,
            },
          ],
        },
        askStreams: {
          [THREAD_ID]: {
            runId: brandedId<ProviderRunId>({ value: 'run-1' }),
            messageId: brandedId<ChatMessageId>({ value: 'message-1' }),
            isStopping: false,
          },
        },
      });
    });

    expect(entryKeys()).not.toContain('action:ask-reset');
  });

  it('resets the Ask chat from the palette', () => {
    act(() => {
      useAppStore.getState().openDrawer({ kind: 'ask', sessionId: SESSION_ID, payload: null });
      useAppStore.setState({ askThreadId: { [SESSION_ID]: THREAD_ID } });
    });
    const { result } = renderHook(() => useCommandEntries(), { wrapper });

    const listener = vi.fn();
    window.addEventListener(ASK_RESET_EVENT, listener);
    act(() => {
      result.current.find((entry) => entry.key === 'action:ask-reset')?.run();
    });
    window.removeEventListener(ASK_RESET_EVENT, listener);

    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('the palette New terminal entry', () => {
  const newTerminal = () => {
    const { result } = renderHook(() => useCommandEntries(), { wrapper });
    return result.current.find((entry) => entry.key === 'action:new-terminal');
  };

  it('opens a fresh tab in the session drawer on the workspace folder of a branchless session', async () => {
    useAppStore.setState({
      sessionBranches: { [SESSION_ID]: '' },
      terminalFolderOverrides: { [WORKSPACE_ID]: '/work/harborline' },
    });
    const entry = newTerminal();

    expect(entry?.label).toBe('New terminal in this session');
    act(() => entry?.run());
    await vi.waitFor(() => expect(useAppStore.getState().drawer?.kind).toBe('terminal'));

    const tabs = useAppStore.getState().terminalTabs[SESSION_ID] ?? [];
    expect(tabs).toHaveLength(1);
    expect(tabs[0]?.cwd).toBe('/work/harborline');
    expect(useAppStore.getState().appStudio).toBeNull();
  });

  it('adds a second tab instead of reusing the one on the same folder', async () => {
    useAppStore.setState({
      sessionBranches: { [SESSION_ID]: '' },
      terminalFolderOverrides: { [WORKSPACE_ID]: '/work/harborline' },
    });

    const entry = newTerminal();

    act(() => entry?.run());
    await vi.waitFor(() => expect(useAppStore.getState().drawer?.kind).toBe('terminal'));
    act(() => entry?.run());
    await vi.waitFor(() => expect(useAppStore.getState().terminalTabs[SESSION_ID]).toHaveLength(2));
  });

  it('keeps the plain label and the Terminal page when a studio covers the session', () => {
    act(() => {
      useAppStore.getState().openStudio({ studio: { kind: 'monitoring' } });
    });

    expect(newTerminal()?.label).toBe('New terminal');
  });
});
