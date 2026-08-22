// @vitest-environment happy-dom

import { useEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';

const { state } = vi.hoisted(() => {
  const session = { id: 'session-1', workspaceId: 'workspace-1' };
  return {
    state: {
      hydrate: vi.fn(async () => undefined),
      checkForUpdates: vi.fn(async () => undefined),
      hydrated: true,
      bootPhase: 'ready' as const,
      error: null,
      workspaceIntegrations: {},
      workspaces: [
        { id: 'workspace-1', name: 'Workspace', rootPath: '/repo', kind: 'repo' as const },
      ],
      sessions: [session],
      sessionProjectMounts: {},
      sessionActiveProject: {},
      sessionBranches: {} as Record<string, string>,
      setSessionStudio: vi.fn(),
      openWorkspace: vi.fn(),
      setCurrentSession: vi.fn(),
      lensGo: vi.fn(),
      currentWorkspaceId: 'workspace-1' as string | null,
      currentSessionId: 'session-1' as string | null,
      activeLens: {} as Record<string, string | null>,
      selectedAgentId: {} as Record<string, string | null>,
      setActiveLens: vi.fn(),
      sessionWorktrees: {},
      providers: [] as ReadonlyArray<{ connection: string }>,
    },
  };
});

const deleteConfirmCalls: Array<{ sessionId: string }> = [];
const archiveConfirmCalls: Array<{ sessionId: string }> = [];

vi.mock('../shared/platform', () => ({ currentPlatform: () => 'darwin' }));

vi.mock('@goodboy/ui', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@goodboy/ui')>()),
  AppShell: () => null,
}));
vi.mock('../app/components/AppFooter', () => ({ AppFooter: () => null }));
vi.mock('../features/session/components/CommandPalette', () => ({ CommandPalette: () => null }));
vi.mock('../app/components/BootSplash', () => ({
  BootSplash: ({ onFinished }: { onFinished: () => void }) => {
    useEffect(() => {
      onFinished();
    }, [onFinished]);
    return null;
  },
}));
vi.mock('../app/components/KeepAliveWorkSurface', () => ({ KeepAliveWorkSurface: () => null }));
vi.mock('../app/components/AppTopBar', () => ({ AppTopBar: () => null }));
vi.mock('../app/components/AppEmptyState', () => ({ NoWorkspaceScreen: () => null }));
vi.mock('../features/workspace/components/StageBoard', () => ({ StageBoard: () => null }));
vi.mock('../features/session/components/DeleteSessionConfirm', () => ({
  DeleteSessionConfirm: ({ session }: { session: { id: string } }) => {
    deleteConfirmCalls.push({ sessionId: session.id });
    return <div data-testid="delete-confirm">{session.id}</div>;
  },
}));
vi.mock('../features/session/components/ArchiveSessionConfirm', () => ({
  ArchiveSessionConfirm: ({ session }: { session: { id: string } }) => {
    archiveConfirmCalls.push({ sessionId: session.id });
    return <div data-testid="archive-confirm">{session.id}</div>;
  },
}));
vi.mock('../features/settings/components/SettingsStudio', () => ({ SettingsStudio: () => null }));
vi.mock('../features/settings/components/GuideStudio', () => ({ GuideStudio: () => null }));
vi.mock('../features/workspace/components/WorkspaceSettingsPane', () => ({
  WorkspaceSettingsPane: () => null,
}));
vi.mock('../app/components/Toast', () => ({
  ToastProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock('../features/workflows/components/WorkflowFollowToastBridge', () => ({
  WorkflowFollowToastBridge: () => null,
}));
vi.mock('../features/notifications/components/NotificationToastBridge', () => ({
  NotificationToastBridge: () => null,
}));
vi.mock('../features/session/components/SessionNavSidebar', () => ({
  SessionNavSidebar: () => null,
}));
vi.mock('../features/workspace/hooks/useWindowPresence', () => ({ useWindowPresence: vi.fn() }));
vi.mock('../features/workspace/components/WorkspaceLinkDialog', () => ({
  WorkspaceLinkDialog: () => null,
}));
vi.mock('../features/workspace/components/WorkspaceLauncher', () => ({
  WorkspaceLauncher: () => null,
}));
vi.mock('../features/workspace/components/WorkspaceSwitcher', () => ({
  WorkspaceSwitcher: () => null,
}));
vi.mock('../features/workspace/window', () => ({ isMainWindow: () => true }));
vi.mock('../features/workflows/components/WorkflowStudio', () => ({ WorkflowStudio: () => null }));
vi.mock('../features/session/components/QuickCreateSession', () => ({
  QuickCreateSession: () => null,
}));
vi.mock('../features/github/components/GitHubStudio', () => ({ GitHubStudio: () => null }));
vi.mock('../features/integrations/linear/LinearStudio', () => ({ LinearStudio: () => null }));
vi.mock('../features/integrations/sentry/SentryStudio', () => ({ SentryStudio: () => null }));
vi.mock('../features/integrations/gitlab/GitlabStudio', () => ({ GitlabStudio: () => null }));
vi.mock('../features/integrations/bitbucket/BitbucketWorkspaceStudio', () => ({
  BitbucketWorkspaceStudio: () => null,
}));
vi.mock('../features/providers/components/ProviderStudio', () => ({ ProviderStudio: () => null }));
vi.mock('../features/budget/components/BudgetStudio', () => ({ BudgetStudio: () => null }));
vi.mock('../features/permissions/components/DiffViewerDialog', () => ({
  DiffViewerDialog: () => null,
}));
vi.mock('../features/github/github', () => ({ ghCommitDiff: vi.fn() }));
vi.mock('../features/worktree/worktree', () => ({ worktreeDiffCommit: vi.fn() }));
vi.mock('../features/onboarding/OnboardingCard', () => ({ OnboardingCard: () => null }));
vi.mock('../features/onboarding/OnboardingWizard', () => ({ OnboardingWizard: () => null }));
vi.mock('../features/companion/CompanionStudio', () => ({ CompanionStudio: () => null }));
vi.mock('../features/companion/commandExecutor', () => ({
  listenBridgeCommands: vi.fn(async () => () => undefined),
}));
vi.mock('../features/onboarding/onboarding-store', () => ({ markStepComplete: vi.fn() }));
vi.mock('../shared/lib/zoom', () => ({
  applyStoredZoom: vi.fn(async () => undefined),
  zoomIn: vi.fn(async () => undefined),
  zoomOut: vi.fn(async () => undefined),
  zoomReset: vi.fn(async () => undefined),
}));
vi.mock('../shared/hooks/useProviderRefreshOnFocus', () => ({
  useProviderRefreshOnFocus: vi.fn(),
}));
vi.mock('../shared/hooks/useCommitLinkInterceptor', () => ({
  useCommitLinkInterceptor: () => ({ commitDiff: null, setCommitDiff: vi.fn() }),
}));
vi.mock('../store', () => {
  const useAppStore = Object.assign(
    vi.fn((selector: (store: typeof state) => unknown) => selector(state)),
    { getState: () => state },
  );
  return {
    useAppStore,
    useCurrentSession: () => state.sessions.find((s) => s.id === state.currentSessionId) ?? null,
    useCurrentWorkspace: () => state.workspaces[0],
    useSessionById: (sessionId: string | null) =>
      state.sessions.find((session) => session.id === sessionId) ?? null,
    useSessions: () => state.sessions,
    useWorkspaces: () => state.workspaces,
  };
});
vi.mock('../features/github/hooks/useGithubPolling', () => ({ useGithubPolling: vi.fn() }));
vi.mock('../features/updater/hooks/useUpdaterPolling', () => ({ useUpdaterPolling: vi.fn() }));

import { App } from '../App';

const pressCombo = (code: string): void => {
  act(() => {
    window.dispatchEvent(
      new KeyboardEvent('keydown', { code, metaKey: true, shiftKey: true, bubbles: true }),
    );
  });
};

const openArchive = (): void => pressCombo('KeyA');
const openDelete = (): void => pressCombo('Backspace');

beforeEach(() => {
  state.currentSessionId = 'session-1';
  deleteConfirmCalls.length = 0;
  archiveConfirmCalls.length = 0;
});

afterEach(() => {
  cleanup();
  state.sessions = state.sessions.slice(0, 1);
});

describe('archive/delete session shortcuts', () => {
  it('opens the archive confirm, not the delete confirm, on the archive shortcut', () => {
    const { container } = render(<App />);

    openArchive();

    expect(container.querySelector('[data-testid="archive-confirm"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="delete-confirm"]')).toBeNull();
    expect(archiveConfirmCalls).toEqual([{ sessionId: 'session-1' }]);
    expect(deleteConfirmCalls).toEqual([]);
  });

  it('opens the delete confirm, not the archive confirm, on the delete shortcut', () => {
    const { container } = render(<App />);

    openDelete();

    expect(container.querySelector('[data-testid="delete-confirm"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="archive-confirm"]')).toBeNull();
    expect(deleteConfirmCalls).toEqual([{ sessionId: 'session-1' }]);
    expect(archiveConfirmCalls).toEqual([]);
  });

  it('no longer listens for the removed open-session events', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');

    render(<App />);

    const openEventAdds = addSpy.mock.calls.filter(
      (call) =>
        call[0] === 'goodboy:open-archive-session' || call[0] === 'goodboy:open-delete-session',
    );
    expect(openEventAdds).toEqual([]);

    addSpy.mockRestore();
  });

  it('dismisses the armed archive confirm on Escape', () => {
    const { container } = render(<App />);

    openArchive();
    expect(container.querySelector('[data-testid="archive-confirm"]')).not.toBeNull();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(container.querySelector('[data-testid="archive-confirm"]')).toBeNull();
  });

  it('dismisses the armed delete confirm on Escape', () => {
    const { container } = render(<App />);

    openDelete();
    expect(container.querySelector('[data-testid="delete-confirm"]')).not.toBeNull();

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(container.querySelector('[data-testid="delete-confirm"]')).toBeNull();
  });
});

describe('shortcut target session', () => {
  it('targets the session the user is currently in', () => {
    state.sessions.push({ id: 'session-2', workspaceId: 'workspace-1' });
    state.currentSessionId = 'session-2';
    const { container } = render(<App />);

    openDelete();

    expect(container.querySelector('[data-testid="delete-confirm"]')).not.toBeNull();
    expect(deleteConfirmCalls).toEqual([{ sessionId: 'session-2' }]);
  });

  it('opens nothing when there is no current session', () => {
    state.currentSessionId = null;
    const { container } = render(<App />);

    openDelete();
    openArchive();

    expect(container.querySelector('[data-testid="delete-confirm"]')).toBeNull();
    expect(container.querySelector('[data-testid="archive-confirm"]')).toBeNull();
    expect(deleteConfirmCalls).toEqual([]);
    expect(archiveConfirmCalls).toEqual([]);
  });
});
