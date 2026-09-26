// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionPlace } from '../../store/slices/navigation/place';
import type { SessionId } from '@goodboy/types';
import { act, cleanup, render } from '@testing-library/react';

const { platform } = vi.hoisted(() => ({ platform: { current: 'darwin' as 'darwin' | 'linux' } }));

vi.mock('../../shared/platform', () => ({ currentPlatform: () => platform.current }));

const { sessionList, state } = vi.hoisted(() => {
  const sessions = [
    { id: 'session-0', workspaceId: 'workspace-1' },
    { id: 'session-1', workspaceId: 'workspace-1' },
  ];
  return {
    sessionList: { current: sessions },
    state: {
      hydrate: vi.fn(async () => undefined),
      checkForUpdates: vi.fn(async () => undefined),
      hydrated: false,
      bootPhase: 'loading' as const,
      error: null,
      workspaceIntegrations: {},
      workspaces: [
        {
          id: 'workspace-1',
          name: 'Workspace',
          rootPath: '/repo',
          kind: 'repo' as 'repo' | 'simple',
        },
      ],
      sessions,
      sessionProjectMounts: {},
      sessionActiveProject: {},
      sessionBranches: { 'session-1': 'feature/branch' } as Record<string, string>,
      navigate: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      openWorkspace: vi.fn(),
      currentWorkspaceId: 'workspace-1' as string | null,
      currentSessionId: 'session-1' as string | null,
      activeLens: {} as Record<string, string | null>,
      selectedAgentId: {} as Record<string, string | null>,
      sessionWorktrees: {},
      appStudio: null,
      openStudio: vi.fn(),
      amendStudio: vi.fn(),
      closeStudio: vi.fn(),
    },
  };
});

vi.mock('@goodboy/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@goodboy/ui')>()),
  AppShell: () => null,
}));
vi.mock('../../app/components/AppFooter', () => ({ AppFooter: () => null }));
vi.mock('../../features/session/components/CommandPalette', () => ({ CommandPalette: () => null }));
vi.mock('../../app/components/BootSplash', () => ({ BootSplash: () => null }));
vi.mock('../../app/components/KeepAliveWorkSurface', () => ({ KeepAliveWorkSurface: () => null }));
vi.mock('../../app/components/AppTopBar', () => ({ AppTopBar: () => null }));
vi.mock('../../app/components/AppEmptyState', () => ({ NoWorkspaceScreen: () => null }));
vi.mock('../../features/workspace/components/StageBoard', () => ({ StageBoard: () => null }));
vi.mock('../../features/session/components/DeleteSessionConfirm', () => ({
  DeleteSessionConfirm: () => null,
}));
vi.mock('../../features/settings/components/SettingsStudio', () => ({
  SettingsStudio: () => null,
}));
vi.mock('../../features/settings/components/GuideStudio', () => ({ GuideStudio: () => null }));
vi.mock('../../app/components/Toast', () => ({ ToastProvider: () => null }));
vi.mock('../../features/notifications/components/NotificationToastBridge', () => ({
  NotificationToastBridge: () => null,
}));
vi.mock('../../features/session/components/SessionNavSidebar', () => ({
  SessionNavSidebar: () => null,
}));
vi.mock('../../features/workspace/hooks/useWindowPresence', () => ({ useWindowPresence: vi.fn() }));
vi.mock('../../features/workspace/components/WorkspaceLinkStudio', () => ({
  WorkspaceLinkStudio: () => null,
}));
vi.mock('../../features/workspace/components/WorkspaceLauncher', () => ({
  WorkspaceLauncher: () => null,
}));
vi.mock('../../features/workspace/components/WorkspaceSwitcher', () => ({
  WorkspaceSwitcher: () => null,
}));
vi.mock('../../features/workspace/window', () => ({ isMainWindow: () => true }));
vi.mock('../../features/workflows/components/WorkflowStudio', () => ({
  WorkflowStudio: () => null,
}));
vi.mock('../../features/github/github', () => ({ ghCommitDiff: vi.fn() }));
vi.mock('../../features/worktree/worktree', () => ({ worktreeDiffCommit: vi.fn() }));
vi.mock('../../features/onboarding/OnboardingWizard', () => ({ OnboardingWizard: () => null }));
vi.mock('../../features/companion/components/CompanionStudio', () => ({
  CompanionStudio: () => null,
}));
vi.mock('../../features/companion/commandExecutor', () => ({
  listenBridgeCommands: vi.fn(async () => () => undefined),
}));
vi.mock('../../features/onboarding/onboarding-store', () => ({ markStepComplete: vi.fn() }));
vi.mock('../../shared/lib/zoom', () => ({
  applyStoredZoom: vi.fn(async () => undefined),
  zoomIn: vi.fn(async () => undefined),
  zoomOut: vi.fn(async () => undefined),
  zoomReset: vi.fn(async () => undefined),
}));
vi.mock('../../shared/hooks/useProviderRefreshOnFocus', () => ({
  useProviderRefreshOnFocus: vi.fn(),
}));
vi.mock('../../shared/hooks/useCommitLinkInterceptor', () => ({
  useCommitLinkInterceptor: () => ({ commitDiff: null, setCommitDiff: vi.fn() }),
}));
vi.mock('../../store', async () => {
  const places = await import('../../store/slices/navigation/place');
  const useAppStore = Object.assign(
    vi.fn((selector: (store: typeof state) => unknown) => selector(state)),
    { getState: () => state, subscribe: () => () => undefined },
  );
  return {
    ...places,
    EMPTY_ARRAY: [],
    useAppStore,
    useCurrentSession: () => state.sessions.find((s) => s.id === state.currentSessionId) ?? null,
    useCurrentWorkspace: () => null,
    useSessionById: (sessionId: string | null) =>
      sessionList.current.find((s) => s.id === sessionId) ?? null,
    useSessions: () => sessionList.current,
    useWorkspaces: () => state.workspaces,
  };
});
vi.mock('../../features/github/hooks/useGithubPolling', () => ({ useGithubPolling: vi.fn() }));
vi.mock('../../features/updater/hooks/useUpdaterPolling', () => ({ useUpdaterPolling: vi.fn() }));

import { App } from '../../App';

const reload = vi.fn();

const lensCalls = (): ReadonlyArray<ReadonlyArray<unknown>> =>
  state.navigate.mock.calls.map(([params]) => {
    const place = (params as { to: { sessionId?: string; view?: { lens: unknown } } }).to;
    return [place.sessionId, place.view?.lens];
  });

type KeyInit = {
  readonly code: string;
  readonly key?: string;
  readonly metaKey?: boolean;
  readonly shiftKey?: boolean;
  readonly altKey?: boolean;
  readonly ctrlKey?: boolean;
};

const press = (init: KeyInit): void => {
  const event = new KeyboardEvent('keydown', { bubbles: true, ...init });
  Object.defineProperty(event, 'getModifierState', { value: () => false });
  act(() => {
    window.dispatchEvent(event);
  });
};

beforeEach(() => {
  platform.current = 'darwin';
  state.workspaces = [{ id: 'workspace-1', name: 'Workspace', rootPath: '/repo', kind: 'repo' }];
  state.sessions = [
    { id: 'session-0', workspaceId: 'workspace-1' },
    { id: 'session-1', workspaceId: 'workspace-1' },
  ];
  sessionList.current = state.sessions;
  state.sessionBranches = { 'session-1': 'feature/branch' };
  state.currentWorkspaceId = 'workspace-1';
  state.currentSessionId = 'session-1';
  state.activeLens = {};
  state.navigate.mockClear();
  state.back.mockClear();
  state.forward.mockClear();
  reload.mockClear();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, reload, hash: '' },
  });
});

afterEach(() => {
  cleanup();
  state.navigate.mockClear();
});

describe('App lens shortcuts off darwin', () => {
  beforeEach(() => {
    platform.current = 'linux';
  });

  it('jumps to the agents lens on ctrl, where the command key does not exist', () => {
    render(<App />);

    press({ code: 'KeyA', key: 'a', ctrlKey: true, altKey: true });

    expect(state.navigate).toHaveBeenCalledWith({
      to: sessionPlace({ sessionId: 'session-1' as SessionId, lens: 'agents' }),
    });
  });

  it('walks to the previous session on ctrl', () => {
    render(<App />);

    press({ code: 'BracketLeft', key: '{', ctrlKey: true, shiftKey: true });

    expect(state.navigate).toHaveBeenCalledWith({
      to: sessionPlace({ sessionId: 'session-0' as SessionId }),
    });
  });

  it('reloads on ctrl', () => {
    render(<App />);

    press({ code: 'KeyR', key: 'r', ctrlKey: true });

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('leaves the command key inert, so nothing double-fires', () => {
    render(<App />);

    press({ code: 'KeyA', key: 'a', metaKey: true, altKey: true });
    press({ code: 'KeyR', key: 'r', metaKey: true });

    expect(state.navigate).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});

describe('App lens shortcuts on darwin', () => {
  it('jumps to the agents lens on the lens plane modifier', () => {
    render(<App />);

    press({ code: 'KeyA', key: 'a', metaKey: true, altKey: true });

    expect(state.navigate).toHaveBeenCalledWith({
      to: sessionPlace({ sessionId: 'session-1' as SessionId, lens: 'agents' }),
    });
  });

  it('leaves the lens alone when the session sidebar toggles', () => {
    render(<App />);

    press({ code: 'KeyB', key: 'b', metaKey: true });

    expect(state.navigate).not.toHaveBeenCalled();
  });

  it('toggles back to the overview when the lens is already active', () => {
    state.activeLens = { 'session-1': 'agents' };
    render(<App />);

    press({ code: 'KeyA', key: 'a', metaKey: true, altKey: true });

    expect(state.navigate).toHaveBeenCalledWith({
      to: sessionPlace({ sessionId: 'session-1' as SessionId, lens: null }),
    });
  });

  it('reaches Context and every legacy Context region shortcut', () => {
    render(<App />);

    press({ code: 'KeyC', key: 'c', metaKey: true, altKey: true });
    press({ code: 'KeyG', key: 'g', metaKey: true, altKey: true });
    press({ code: 'KeyE', key: 'e', metaKey: true, altKey: true });
    press({ code: 'KeyU', key: 'u', metaKey: true, altKey: true });

    expect(lensCalls()).toEqual([
      ['session-1', 'context'],
      ['session-1', 'goal'],
      ['session-1', 'decisions'],
      ['session-1', 'last_output_summary'],
    ]);
  });

  it('reaches the integration lenses that had no binding before', () => {
    render(<App />);

    press({ code: 'Digit2', key: '2', metaKey: true, altKey: true });
    press({ code: 'Digit3', key: '3', metaKey: true, altKey: true });
    press({ code: 'Digit4', key: '4', metaKey: true, altKey: true });
    press({ code: 'Digit6', key: '6', metaKey: true, altKey: true });

    expect(lensCalls()).toEqual([
      ['session-1', 'linear'],
      ['session-1', 'gitlab_issues'],
      ['session-1', 'slack_threads'],
    ]);
  });

  it('walks to the previous session from the bracket key', () => {
    render(<App />);

    press({ code: 'BracketLeft', key: '{', metaKey: true, shiftKey: true });

    expect(state.navigate).toHaveBeenCalledWith({
      to: sessionPlace({ sessionId: 'session-0' as SessionId }),
    });
  });

  it('walks the history back and forward on the bracket keys', () => {
    render(<App />);

    press({ code: 'BracketLeft', key: '[', metaKey: true });
    press({ code: 'BracketRight', key: ']', metaKey: true });

    expect(state.back).toHaveBeenCalledTimes(1);
    expect(state.forward).toHaveBeenCalledTimes(1);
  });

  it('walks the history on the mouse back and forward buttons', () => {
    render(<App />);

    act(() => {
      window.dispatchEvent(new MouseEvent('mouseup', { button: 3 }));
      window.dispatchEvent(new MouseEvent('mouseup', { button: 4 }));
      window.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
    });

    expect(state.back).toHaveBeenCalledTimes(1);
    expect(state.forward).toHaveBeenCalledTimes(1);
  });

  it('returns to the board', () => {
    render(<App />);

    press({ code: 'KeyH', key: 'h', metaKey: true, shiftKey: true });

    expect(state.navigate).toHaveBeenCalledWith({ to: { at: 'board' } });
  });

  it('routes the diff binding to the Diff lens for repo-backed sessions', () => {
    render(<App />);

    press({ code: 'KeyF', key: 'f', metaKey: true, altKey: true });
    press({ code: 'KeyX', key: 'x', metaKey: true, altKey: true });

    expect(lensCalls()).toEqual([['session-1', 'files']]);
  });

  it('routes the explore binding to the Explore lens for branchless sessions', () => {
    state.workspaces = [
      { id: 'workspace-1', name: 'Workspace', rootPath: '/simple', kind: 'simple' },
    ];
    state.sessionBranches = { 'session-1': '' };
    render(<App />);

    press({ code: 'KeyX', key: 'x', metaKey: true, altKey: true });
    press({ code: 'KeyF', key: 'f', metaKey: true, altKey: true });

    expect(lensCalls()).toEqual([['session-1', 'explore']]);
  });

  it('reloads on the plain reload combo', () => {
    render(<App />);

    press({ code: 'KeyR', key: 'r', metaKey: true });

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does not reload when the Resolve lens combo fires', () => {
    render(<App />);

    press({ code: 'KeyR', key: 'r', metaKey: true, shiftKey: true });

    expect(reload).not.toHaveBeenCalled();
    expect(state.navigate).not.toHaveBeenCalled();
  });

  it('reaches the Review lens on the one lens binding it has', () => {
    render(<App />);

    press({ code: 'KeyR', key: 'r', metaKey: true, altKey: true });

    expect(state.navigate).toHaveBeenCalledWith({
      to: sessionPlace({ sessionId: 'session-1' as SessionId, lens: 'review' }),
    });
    expect(reload).not.toHaveBeenCalled();
  });
});
