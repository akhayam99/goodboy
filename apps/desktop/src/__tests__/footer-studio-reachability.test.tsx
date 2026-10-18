// @vitest-environment happy-dom

import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';

const { githubAuth } = vi.hoisted(() => ({ githubAuth: { isAuthenticated: false } }));

vi.mock('../shared/platform', () => ({ currentPlatform: () => 'darwin' }));

const { state, workspace, storeListeners } = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const currentWorkspace = {
    id: 'workspace-1',
    name: 'Workspace',
    rootPath: '/repo',
    kind: 'repo' as const,
  };
  const notify = () => listeners.forEach((listener) => listener());
  const studioState = {
    appStudio: null as { readonly kind: string } | null,
  };
  return {
    workspace: currentWorkspace,
    storeListeners: listeners,
    state: {
      hydrate: vi.fn(async () => undefined),
      checkForUpdates: vi.fn(async () => undefined),
      hydrated: true,
      bootPhase: 'ready' as const,
      error: null,
      workspaceIntegrations: {} as Record<string, ReadonlyArray<{ provider: string }>>,
      workspaces: [currentWorkspace],
      sessions: [] as ReadonlyArray<{ id: string; workspaceId: string }>,
      sessionProjectMounts: {},
      sessionActiveProject: {},
      sessionBranches: {} as Record<string, string>,
      openWorkspace: vi.fn(),
      currentWorkspaceId: 'workspace-1' as string | null,
      currentSessionId: null as string | null,
      activeLens: {} as Record<string, string | null>,
      selectedAgentId: {} as Record<string, string | null>,
      sessionWorktrees: {},
      providers: [] as ReadonlyArray<{ connection: string }>,
      settings: {} as Record<string, string | undefined>,
      loadSetting: vi.fn(async () => undefined),
      get appStudio() {
        return studioState.appStudio;
      },
      set appStudio(next: { readonly kind: string } | null) {
        studioState.appStudio = next;
      },
      openStudio: ({ studio }: { readonly studio: { readonly kind: string } }) => {
        studioState.appStudio = studio;
        notify();
      },
      switchStudio: ({ studio }: { readonly studio: { readonly kind: string } }) => {
        studioState.appStudio = studio;
        notify();
      },
      amendStudio: ({ studio }: { readonly studio: { readonly kind: string } }) => {
        studioState.appStudio = studio;
        notify();
      },
      closeStudio: () => {
        studioState.appStudio = null;
        notify();
      },
    },
  };
});

type ShellProps = {
  readonly topBar?: ReactNode;
  readonly studio?: ReactNode;
};

vi.mock('@goodboy/ui', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@goodboy/ui')>();
  return {
    ...actual,
    AppShell: ({ topBar, studio }: ShellProps) => (
      <div>
        {topBar}
        {studio}
      </div>
    ),
  };
});

vi.mock('../features/integrations/github/useGithubConnection', () => ({
  useGithubConnection: () => ({
    isAuthenticated: githubAuth.isAuthenticated,
    isResolved: true,
    refresh: vi.fn(),
  }),
}));

vi.mock('../features/inbox/components/InboxStudio', () => ({
  InboxStudio: ({ initialProvider }: { initialProvider: string | null }) => (
    <div data-testid="inbox-studio">{initialProvider ?? 'all'}</div>
  ),
}));

vi.mock('../features/palette/components/PaletteOverlay', () => ({
  PaletteOverlay: () => null,
}));
vi.mock('../app/components/BootSplash', () => ({
  BootSplash: ({ onFinished }: { onFinished: () => void }) => {
    useEffect(() => {
      onFinished();
    }, [onFinished]);
    return null;
  },
}));
vi.mock('../app/components/KeepAliveWorkSurface', () => ({ KeepAliveWorkSurface: () => null }));
vi.mock('../app/components/AppTopBar', () => ({
  AppTopBar: ({ onOpenSpend }: { onOpenSpend: () => void }) => (
    <button type="button" onClick={onOpenSpend}>
      Open spend
    </button>
  ),
}));
vi.mock('../features/workspace/components/StageBoard', () => ({ StageBoard: () => null }));
vi.mock('../features/session/components/DeleteSessionConfirm', () => ({
  DeleteSessionConfirm: () => null,
}));
vi.mock('../features/settings/components/SettingsStudio', () => ({
  SettingsStudio: ({ focus }: { focus: { scope: string; tool?: string } }) => (
    <div data-testid="settings-studio" data-scope={focus.scope} data-tool={focus.tool} />
  ),
}));
vi.mock('../features/settings/components/GuideStudio', () => ({ GuideStudio: () => null }));
vi.mock('../shared/components/Toast', () => ({
  ToastProvider: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useToast: () => ({ showToast: vi.fn() }),
}));
vi.mock('../features/notifications/components/NotificationToastBridge', () => ({
  NotificationToastBridge: () => null,
}));
vi.mock('../features/session/components/NewSessionBridge', () => ({
  NewSessionBridge: () => null,
}));
vi.mock('../features/workflows/components/WorkflowFollowToastBridge', () => ({
  WorkflowFollowToastBridge: () => null,
}));
vi.mock('../features/session/components/SessionNavSidebar', () => ({
  SessionNavSidebar: () => null,
}));
vi.mock('../features/workspace/hooks/useWindowPresence', () => ({ useWindowPresence: vi.fn() }));
vi.mock('../features/workspace/components/WorkspaceLinkStudio', () => ({
  WorkspaceLinkStudio: () => null,
}));
vi.mock('../features/workspace/components/WorkspaceLauncher', () => ({
  WorkspaceLauncher: () => null,
}));
vi.mock('../features/workspace/components/WorkspaceSwitcher', () => ({
  WorkspaceSwitcher: () => null,
}));
vi.mock('../features/workspace/window', () => ({
  isMainWindow: () => true,
  currentWindowLabel: () => 'main',
  onWindowClose: async () => () => undefined,
}));
vi.mock('../features/workflows/components/WorkflowStudio', () => ({ WorkflowStudio: () => null }));
vi.mock('../features/impact/components/ImpactStudio', () => ({
  ImpactStudio: ({ initialScope }: { initialScope?: { kind: string; sessionId?: string } }) => (
    <div
      data-testid="impact-studio"
      data-scope={initialScope?.kind ?? 'none'}
      data-session={initialScope?.sessionId ?? ''}
    >
      Impact
    </div>
  ),
}));
vi.mock('../features/changelog/components/ChangelogStudio', () => ({
  ChangelogStudio: () => <div data-testid="changelog-studio">Changelog</div>,
}));
vi.mock('../features/integrations/github/github', () => ({ ghCommitDiff: vi.fn() }));
vi.mock('../features/worktree/worktree', () => ({
  worktreeDiffCommit: vi.fn(),
  worktreeSnapshot: vi.fn(),
}));
vi.mock('../features/onboarding/OnboardingWizard', () => ({ OnboardingWizard: () => null }));
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
vi.mock('../features/workspace/hooks/useSessionPinsSync', () => ({
  useSessionPinsSync: vi.fn(),
}));
vi.mock('../shared/hooks/useCommitLinkInterceptor', () => ({
  useCommitLinkInterceptor: () => ({ commitDiff: null, setCommitDiff: vi.fn() }),
}));
vi.mock('../store', async () => {
  const { useEffect: useMountEffect, useReducer } = await import('react');
  const useAppStore = Object.assign(
    vi.fn((selector: (store: typeof state) => unknown) => {
      const [, rerender] = useReducer((count: number) => count + 1, 0);
      useMountEffect(() => {
        const listener = () => rerender();
        storeListeners.add(listener);
        return () => {
          storeListeners.delete(listener);
        };
      }, []);
      return selector(state);
    }),
    { getState: () => state, subscribe: () => () => undefined },
  );
  return {
    useAppStore,
    useCurrentSession: () => null,
    useCurrentWorkspace: () => (state.currentWorkspaceId === null ? null : workspace),
    useSessionById: () => null,
    useSessions: () => state.sessions,
    useSessionColumn: () => ({ order: state.sessions.map((session) => session.id) }),
    useWorkspaces: () => state.workspaces,
  };
});
vi.mock('../features/integrations/github/hooks/useGithubPolling', () => ({
  useGithubPolling: vi.fn(),
}));
vi.mock('../features/monitoring/hooks/useMonitoringSignalRefresh', () => ({
  useMonitoringSignalRefresh: vi.fn(),
}));
vi.mock('../features/updater/hooks/useUpdaterPolling', () => ({ useUpdaterPolling: vi.fn() }));
vi.mock('../features/artifacts/hooks/useArtifactMirror', () => ({ useArtifactMirror: vi.fn() }));

import { App } from '../App';

beforeEach(() => {
  state.appStudio = null;
  state.settings = {};
  state.workspaceIntegrations = {};
  state.workspaces = [workspace];
  state.currentWorkspaceId = 'workspace-1';
  githubAuth.isAuthenticated = false;
});

afterEach(() => {
  cleanup();
});

describe('Spend reachability from the top bar', () => {
  it('lands the top bar spend chip on the impact spend tab', async () => {
    render(<App />);

    expect(screen.queryByTestId('impact-studio')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Open spend' }));

    expect((await screen.findByTestId('impact-studio')).getAttribute('data-scope')).toBe('spend');
  });
});

describe('Spend reachability through the impact studio', () => {
  it('opens the impact studio at a session scope from the impact studio event', () => {
    render(<App />);

    act(() =>
      window.dispatchEvent(
        new CustomEvent('goodboy:open-impact-studio', {
          detail: { scope: { kind: 'session', sessionId: 'session-1' } },
        }),
      ),
    );

    const studio = screen.getByTestId('impact-studio');
    expect(studio.getAttribute('data-scope')).toBe('session');
    expect(studio.getAttribute('data-session')).toBe('session-1');
  });

  it('opens the impact studio at a provider scope from the impact studio event', () => {
    render(<App />);

    act(() =>
      window.dispatchEvent(
        new CustomEvent('goodboy:open-impact-studio', {
          detail: { scope: { kind: 'provider', provider: 'anthropic' } },
        }),
      ),
    );

    expect(screen.getByTestId('impact-studio').getAttribute('data-scope')).toBe('provider');
    expect(screen.queryByTestId('settings-studio')).toBeNull();
  });
});
