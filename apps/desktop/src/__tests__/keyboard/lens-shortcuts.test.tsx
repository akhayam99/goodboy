// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';

const { setActiveLens, shortcutHandlers, state } = vi.hoisted(() => {
  const activeLensSetter = vi.fn();
  return {
    setActiveLens: activeLensSetter,
    shortcutHandlers: new Map<string, () => void>(),
    state: {
      hydrate: vi.fn(async () => undefined),
      checkForUpdates: vi.fn(async () => undefined),
      hydrated: false,
      bootPhase: 'loading' as const,
      error: null,
      sessionsSidebarCollapsed: false,
      toggleSessionsSidebar: vi.fn(),
      workspaceIntegrations: {},
      workspaces: [],
      setSessionStudio: vi.fn(),
      openWorkspace: vi.fn(),
      setCurrentSession: vi.fn(),
      lensGo: vi.fn(),
      currentSessionId: 'session-1',
      setActiveLens: activeLensSetter,
      sessionWorktrees: {},
    },
  };
});

vi.mock('@goodboy/ui', () => ({ AppShell: () => null }));
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
vi.mock('../../features/session/components/ArchiveSessionConfirm', () => ({
  ArchiveSessionConfirm: () => null,
}));
vi.mock('../../features/settings/components/SettingsStudio', () => ({
  SettingsStudio: () => null,
}));
vi.mock('../../features/settings/components/GuideStudio', () => ({ GuideStudio: () => null }));
vi.mock('../../features/workspace/components/WorkspaceSettingsPane', () => ({
  WorkspaceSettingsPane: () => null,
}));
vi.mock('../../app/components/Toast', () => ({ ToastProvider: () => null }));
vi.mock('../../features/notifications/components/NotificationToastBridge', () => ({
  NotificationToastBridge: () => null,
}));
vi.mock('../../features/workspace/components/WorkspaceHeader', () => ({
  WorkspaceHeader: () => null,
}));
vi.mock('../../features/workspace/components/WorkspacesSidebar', () => ({
  WorkspacesSidebar: () => null,
}));
vi.mock('../../features/workspace/hooks/useWindowPresence', () => ({ useWindowPresence: vi.fn() }));
vi.mock('../../features/workspace/components/WorkspaceLinkDialog', () => ({
  WorkspaceLinkDialog: () => null,
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
vi.mock('../../features/session/components/NewSessionView', () => ({ NewSessionView: () => null }));
vi.mock('../../features/github/components/GitHubStudio', () => ({ GitHubStudio: () => null }));
vi.mock('../../features/integrations/linear/LinearStudio', () => ({ LinearStudio: () => null }));
vi.mock('../../features/integrations/sentry/SentryStudio', () => ({ SentryStudio: () => null }));
vi.mock('../../features/integrations/gitlab/GitlabStudio', () => ({ GitlabStudio: () => null }));
vi.mock('../../features/providers/components/ProviderStudio', () => ({
  ProviderStudio: () => null,
}));
vi.mock('../../features/budget/components/BudgetStudio', () => ({ BudgetStudio: () => null }));
vi.mock('../../features/permissions/components/DiffViewerDialog', () => ({
  DiffViewerDialog: () => null,
}));
vi.mock('../../features/github/github', () => ({ ghCommitDiff: vi.fn() }));
vi.mock('../../features/worktree/worktree', () => ({ worktreeDiffCommit: vi.fn() }));
vi.mock('../../features/onboarding/OnboardingCard', () => ({ OnboardingCard: () => null }));
vi.mock('../../features/onboarding/OnboardingWizard', () => ({ OnboardingWizard: () => null }));
vi.mock('../../features/companion/CompanionStudio', () => ({ CompanionStudio: () => null }));
vi.mock('../../features/companion/commandExecutor', () => ({
  listenBridgeCommands: vi.fn(async () => () => undefined),
}));
vi.mock('../../features/onboarding/onboarding-store', () => ({ markStepComplete: vi.fn() }));
vi.mock('../../features/terminal/closeTab', () => ({ disposeTerminalPty: vi.fn() }));
vi.mock('../../shared/hooks/useKeyboardShortcut', () => ({
  useKeyboardShortcut: (combo: string, handler: () => void) => {
    shortcutHandlers.set(combo, handler);
  },
}));
vi.mock('../../shared/hooks/useProviderRefreshOnFocus', () => ({
  useProviderRefreshOnFocus: vi.fn(),
}));
vi.mock('../../shared/hooks/useZoomShortcuts', () => ({ useZoomShortcuts: vi.fn() }));
vi.mock('../../shared/hooks/useEscapeToCloseDialog', () => ({ useEscapeToCloseDialog: vi.fn() }));
vi.mock('../../shared/hooks/useCommitLinkInterceptor', () => ({
  useCommitLinkInterceptor: () => ({ commitDiff: null, setCommitDiff: vi.fn() }),
}));
vi.mock('../../store', () => {
  const useAppStore = Object.assign(
    vi.fn((selector: (store: typeof state) => unknown) => selector(state)),
    { getState: () => state },
  );
  return {
    useAppStore,
    useCurrentSession: () => null,
    useCurrentWorkspace: () => null,
    useSessions: () => [],
    useWorkspaces: () => [],
  };
});
vi.mock('../../features/providers/provider-pricing', () => ({ refreshPricingTable: vi.fn() }));
vi.mock('../../features/github/hooks/useGithubPolling', () => ({ useGithubPolling: vi.fn() }));
vi.mock('../../features/updater/hooks/useUpdaterPolling', () => ({ useUpdaterPolling: vi.fn() }));

import { App } from '../../App';

afterEach(() => {
  cleanup();
  setActiveLens.mockClear();
  shortcutHandlers.clear();
});

describe('App lens shortcuts', () => {
  it('dispatches overview, pull request, decisions, and summary lenses', () => {
    render(<App />);

    const expected = [
      ['cmd+shift+o', null],
      ['cmd+shift+h', 'pr'],
      ['cmd+shift+e', 'decisions'],
      ['cmd+shift+u', 'last_output_summary'],
    ] as const;

    act(() => {
      expected.forEach(([combo]) => shortcutHandlers.get(combo)?.());
    });

    expect(setActiveLens.mock.calls).toEqual(expected.map(([, lens]) => ['session-1', lens]));
  });

  it('returns to the board on cmd+shift+escape', () => {
    render(<App />);

    act(() => {
      shortcutHandlers.get('cmd+shift+escape')?.();
    });

    expect(state.setCurrentSession).toHaveBeenCalledWith(null);
  });
});
