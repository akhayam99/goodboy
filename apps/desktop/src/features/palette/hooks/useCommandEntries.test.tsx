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
import { aProject, aSession, aWorkspace } from '@goodboy/types/testing';
import type {
  ChatId,
  ChatMessageId,
  IsoDateTime,
  ProviderId,
  ProviderRunId,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { innerColumnStore } from '@goodboy/ui';
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
import {
  OPEN_WIZARD_EVENT,
  finishWizard,
  hydrateOnboardingFromDb,
} from '../../onboarding/onboardingSettings';
import { GUIDE_CHAPTERS } from '../../settings/components/GuideStudio/guideChapters';
import { peekGuideChapter } from '../../settings/components/GuideStudio/guideChapterRequest';
import { useThemeStore } from '../../../shared/lib/theme';
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

const entryFor = (key: string) => {
  const { result } = renderHook(() => useCommandEntries(), { wrapper });
  return result.current.find((entry) => entry.key === key);
};

describe('the palette entries of the workspace doors', () => {
  beforeEach(async () => {
    await hydrateOnboardingFromDb();
  });

  it('lists New workspace once, found by its former names, and opens the one door', () => {
    const onNew = vi.fn();
    window.addEventListener('goodboy:add-workspace', onNew);
    const keys = entryKeys();
    const entry = entryFor('action:new-workspace');
    entry?.run();
    window.removeEventListener('goodboy:add-workspace', onNew);

    expect(keys.filter((key) => key === 'action:new-workspace')).toHaveLength(1);
    expect(keys).not.toContain('goto:start-new-project');
    expect(keys).not.toContain('goto:add-workspace');
    expect(entry?.label).toBe('New workspace');
    expect(entry?.secondary).toEqual(
      expect.arrayContaining(['Open a folder', 'Start a new project']),
    );
    expect(onNew).toHaveBeenCalledOnce();
  });

  it('offers Theme: dark, light and system, each writing its own preference', () => {
    const { result } = renderHook(() => useCommandEntries(), { wrapper });
    const entryOf = (choice: string) =>
      result.current.find((entry) => entry.key === `action:theme-${choice}`);

    expect(['dark', 'light', 'system'].map((choice) => entryOf(choice)?.label)).toEqual([
      'Theme: dark',
      'Theme: light',
      'Theme: system',
    ]);
    entryOf('system')?.run();
    expect(useThemeStore.getState().preference).toBe('system');
    entryOf('dark')?.run();
    expect(useThemeStore.getState().preference).toBe('dark');
    expect(result.current.map((entry) => entry.key)).not.toContain('action:toggle-theme');
    expect(entryOf('dark')?.secondary).toEqual(
      expect.arrayContaining(['Switch to light mode', 'Switch to dark mode']),
    );
  });

  it('offers Resume setup while setup is unfinished and resumes it in the main window', () => {
    const onOpen = vi.fn();
    window.addEventListener(OPEN_WIZARD_EVENT, onOpen);
    entryFor('action:resume-setup')?.run();
    window.removeEventListener(OPEN_WIZARD_EVENT, onOpen);

    expect(onOpen).toHaveBeenCalledOnce();
    expect(onOpen.mock.lastCall?.[0]).toMatchObject({ detail: { mode: 'setup' } });
  });

  it('drops Resume setup once setup is done', async () => {
    stubStoryInvoke({ db_select: [], db_execute: { rowsAffected: 1 } });
    await act(async () => {
      await finishWizard();
    });

    expect(entryKeys()).not.toContain('action:resume-setup');
  });
});

describe('the palette groups', () => {
  it('files places under Go to, creations under Create and helps under Help', () => {
    const kindOf = (key: string) => entryFor(key)?.kind;

    expect(kindOf('goto:board')).toBe('goto');
    expect(kindOf('action:settings')).toBe('goto');
    expect(kindOf('action:new-session')).toBe('create');
    expect(kindOf('action:new-chat')).toBe('create');
    expect(kindOf('action:new-terminal')).toBe('create');
    expect(kindOf('action:new-workspace')).toBe('create');
    expect(kindOf('action:theme-dark')).toBe('action');
    expect(kindOf('action:theme-light')).toBe('action');
    expect(kindOf('action:theme-system')).toBe('action');
    expect(kindOf('action:check-updates')).toBe('action');
    expect(kindOf('goto:changelog')).toBe('help');
    expect(kindOf('action:report-issue')).toBe('help');
  });

  it('names Pair an iPhone and still finds it by the old words', () => {
    const entry = entryFor('action:pair-device');

    expect(entry?.label).toBe('Pair an iPhone');
    expect(entry?.secondary).toEqual(expect.arrayContaining(['Pair your iPhone']));
  });

  it('adds one typed-only Guide entry per chapter that opens that chapter', () => {
    const keys = entryKeys();
    const entry = entryFor('guide:commits');

    expect(keys.filter((key) => key.startsWith('guide:'))).toHaveLength(GUIDE_CHAPTERS.length);
    expect(entry?.label).toBe('Guide: Commits');
    expect(entry?.kind).toBe('page');
    entry?.run();

    expect(peekGuideChapter()).toBe('commits');
  });
});

describe('the palette entry for the inner column', () => {
  it('leaves it out on a page with no inner column and names the column once one shows', () => {
    expect(entryKeys()).not.toContain('action:inner-column');

    const toggle = vi.fn();
    const key = innerColumnStore.add({
      column: { id: 'chat', label: 'Fold the chat list', toggle },
    });
    const { result } = renderHook(() => useCommandEntries(), { wrapper });
    const entry = result.current.find((candidate) => candidate.key === 'action:inner-column');
    innerColumnStore.remove({ key });

    expect(entry?.label).toBe('Fold the chat list');
    expect(entry?.shortcut).toBe('innerColumn.toggle');
    entry?.run();
    expect(toggle).toHaveBeenCalledTimes(1);
  });
});

describe('the palette entries for new things', () => {
  it('lists New session, New chat and New terminal so Cmd+K reaches every new', () => {
    const keys = entryKeys();

    expect(keys).toContain('action:new-session');
    expect(keys).toContain('action:new-chat');
    expect(keys).toContain('action:new-terminal');
  });

  it('opens the New session page on a workflow or an agent, by the names of the page', () => {
    const openSessionDraft = vi.fn();
    useAppStore.setState({ openSessionDraft });

    const workflow = entryFor('action:new-session-workflow');
    expect(workflow?.label).toBe('New workflow session');
    expect(workflow?.secondary).toEqual(['New workflow', 'Orchestrated', 'Preset']);
    act(() => workflow?.run());
    expect(useAppStore.getState().sessionDrafts[WORKSPACE_ID]).toMatchObject({
      startKind: 'workflow',
      startShape: null,
      hasChosenStart: true,
    });

    const agent = entryFor('action:new-session-agent');
    act(() => agent?.run());
    expect(useAppStore.getState().sessionDrafts[WORKSPACE_ID]?.startKind).toBe('agent');
    expect(openSessionDraft).toHaveBeenCalledTimes(2);
  });

  it('opens Auto picks from Start a run outside a session, and leaves it to the session inside one', () => {
    expect(entryKeys()).not.toContain('action:start-run-auto-picks');
    useAppStore.setState({ currentSessionId: null, openSessionDraft: vi.fn() });

    const start = entryFor('action:start-run-auto-picks');
    expect(start?.label).toBe('Start a run');
    act(() => start?.run());
    expect(useAppStore.getState().sessionDrafts[WORKSPACE_ID]?.startKind).toBe('auto');
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

describe('the palette pull entries', () => {
  it('lists a pull row per linked repo and one for all of them', () => {
    useAppStore.setState({
      projects: [
        aProject({ workspaceId: WORKSPACE_ID, name: 'ledger-core', baseBranch: 'main' }),
        aProject({ workspaceId: WORKSPACE_ID, name: 'notify-relay', baseBranch: 'main' }),
      ],
    });
    const { result } = renderHook(() => useCommandEntries(), { wrapper });

    const labels = result.current.map((entry) => entry.label);

    expect(labels).toContain('Pull main in all linked repos');
    expect(labels).toContain('Pull main in ledger-core');
    expect(labels).toContain('Pull main in notify-relay');
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
