import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@goodboy/ui';
import { AppFooter } from './app/components/AppFooter';
import type {
  PlanId,
  ProviderId,
  ProviderLifecycleAction,
  SessionId,
  WorkspaceId,
} from '@goodboy/types';
import { CommandPalette } from './features/session/components/CommandPalette';
import { BootSplash } from './app/components/BootSplash';
import { KeepAliveWorkSurface } from './app/components/KeepAliveWorkSurface';
import { AppTopBar } from './app/components/AppTopBar';
import { NoWorkspaceScreen } from './app/components/AppEmptyState';
import { StageBoard } from './features/workspace/components/StageBoard';
import { DeleteSessionDialog } from './features/session/components/DeleteSessionDialog';
import { ArchiveSessionDialog } from './features/session/components/ArchiveSessionDialog';
import { SettingsStudio } from './features/settings/components/SettingsStudio';
import { GuideStudio } from './features/settings/components/GuideStudio';
import { WorkspaceSettingsPane } from './features/workspace/components/WorkspaceSettingsPane';
import { SessionSettingsPane } from './features/session/components/SessionSettingsPane';
import { ToastProvider } from './app/components/Toast';
import { NotificationToastBridge } from './features/notifications/components/NotificationToastBridge';
import { WorkspacesSidebar } from './features/workspace/components/WorkspacesSidebar';
import { useWindowPresence } from './features/workspace/hooks/useWindowPresence';
import { WorkspaceLinkDialog } from './features/workspace/components/WorkspaceLinkDialog';
import { WorkspaceLauncher } from './features/workspace/components/WorkspaceLauncher';
import { WorkspaceSwitcher } from './features/workspace/components/WorkspaceSwitcher';
import { isMainWindow } from './features/workspace/window';
import { WorkflowStudio } from './features/workflows/components/WorkflowStudio';
import { NewSessionView } from './features/session/components/NewSessionView';
import { GitHubStudio } from './features/github/components/GitHubStudio';
import { LinearStudio } from './features/integrations/linear/LinearStudio';
import { SentryStudio } from './features/integrations/sentry/SentryStudio';
import { GitlabStudio } from './features/integrations/gitlab/GitlabStudio';
import { ProviderStudio } from './features/providers/components/ProviderStudio';
import { BudgetStudio } from './features/budget/components/BudgetStudio';
import type { BudgetScope } from './features/budget/components/BudgetStudio/lib';
import { DiffViewerDialog } from './features/permissions/components/DiffViewerDialog';
import { ghCommitDiff } from './features/github/github';
import { worktreeDiffCommit } from './features/worktree/worktree';
import { OnboardingCard } from './features/onboarding/OnboardingCard';
import { OnboardingWizard } from './features/onboarding/OnboardingWizard';
import { CompanionStudio } from './features/companion/CompanionStudio';
import { listenBridgeCommands } from './features/companion/commandExecutor';
import { markStepComplete } from './features/onboarding/onboarding-store';
import { useKeyboardShortcut } from './shared/hooks/useKeyboardShortcut';
import { useProviderRefreshOnFocus } from './shared/hooks/useProviderRefreshOnFocus';
import { useZoomShortcuts } from './shared/hooks/useZoomShortcuts';
import { useEscapeToCloseDialog } from './shared/hooks/useEscapeToCloseDialog';
import { useCommitLinkInterceptor } from './shared/hooks/useCommitLinkInterceptor';
import {
  useAppStore,
  useCurrentSession,
  useCurrentWorkspace,
  useSessions,
  useWorkspaces,
} from './store';
import { refreshPricingTable } from './features/providers/provider-pricing';
import { useGithubPolling } from './features/github/hooks/useGithubPolling';
import { useUpdaterPolling } from './features/updater/hooks/useUpdaterPolling';

const KEEP_ALIVE_CAP = 5;

export const App = () => {
  const hydrate = useAppStore((s) => s.hydrate);
  const checkForUpdates = useAppStore((s) => s.checkForUpdates);
  const hydrated = useAppStore((s) => s.hydrated);
  const bootPhase = useAppStore((s) => s.bootPhase);
  const error = useAppStore((s) => s.error);
  const [splashFinished, setSplashFinished] = useState(false);
  const workspaces = useWorkspaces();
  const hasWorkspaces = workspaces.length > 0;
  const currentWorkspace = useCurrentWorkspace();
  const currentSession = useCurrentSession();
  const hasLinear = useAppStore((s) =>
    (s.workspaceIntegrations?.[currentWorkspace?.id ?? ('' as WorkspaceId)] ?? []).some(
      (i) => i.provider === 'linear',
    ),
  );
  const hasSentry = useAppStore((s) =>
    (s.workspaceIntegrations?.[currentWorkspace?.id ?? ('' as WorkspaceId)] ?? []).some(
      (i) => i.provider === 'sentry',
    ),
  );
  const hasGitlab = useAppStore((s) =>
    (s.workspaceIntegrations?.[currentWorkspace?.id ?? ('' as WorkspaceId)] ?? []).some(
      (i) => i.provider === 'gitlab',
    ),
  );
  const [companionOpen, setCompanionOpen] = useState(false);
  const [appSettingsOpen, setAppSettingsOpen] = useState(false);
  const [appSettingsFocus, setAppSettingsFocus] = useState<string | undefined>(undefined);
  const [guideStudioOpen, setGuideStudioOpen] = useState(false);
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false);
  const [workspaceSettingsFocus, setWorkspaceSettingsFocus] = useState<string | undefined>(
    undefined,
  );
  const [sessionSettingsOpen, setSessionSettingsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [palettePrefix, setPalettePrefix] = useState('');
  const [addWorkspaceOpen, setAddWorkspaceOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [workflowStudioOpen, setWorkflowStudioOpen] = useState(false);
  const [linearStudioOpen, setLinearStudioOpen] = useState(false);
  const [linearStudioFocus, setLinearStudioFocus] = useState<string | null>(null);
  const [sentryStudioOpen, setSentryStudioOpen] = useState(false);
  const [sentryStudioFocus, setSentryStudioFocus] = useState<string | null>(null);
  const [gitlabStudioOpen, setGitlabStudioOpen] = useState(false);
  const [gitlabStudioFocus, setGitlabStudioFocus] = useState<string | null>(null);
  const [providerStudioOpen, setProviderStudioOpen] = useState(false);
  const [providerStudioFocus, setProviderStudioFocus] = useState<ProviderId | null>(null);
  const [providerStudioAction, setProviderStudioAction] = useState<ProviderLifecycleAction | null>(
    null,
  );
  const [githubStudioOpen, setGithubStudioOpen] = useState(false);
  const [githubStudioSession, setGithubStudioSession] = useState<SessionId | null>(null);
  const [githubStudioPrNumber, setGithubStudioPrNumber] = useState<number | null>(null);
  const [githubStudioThreadId, setGithubStudioThreadId] = useState<string | null>(null);
  const [budgetStudioOpen, setBudgetStudioOpen] = useState(false);
  const [budgetStudioScope, setBudgetStudioScope] = useState<BudgetScope | undefined>(undefined);
  const setSessionStudio = useAppStore((s) => s.setSessionStudio);
  const clearSessionStudio = useCallback(() => {
    const id = useAppStore.getState().currentSessionId;
    if (id) {
      useAppStore.getState().setSessionStudio(id, null);
    }
  }, []);
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const { commitDiff, setCommitDiff } = useCommitLinkInterceptor();
  const [keepAliveIds, setKeepAliveIds] = useState<ReadonlyArray<SessionId>>([]);

  useEffect(() => {
    void hydrate();
    void refreshPricingTable();
    if (import.meta.env.PROD) {
      void checkForUpdates();
    }
  }, [hydrate, checkForUpdates]);

  useGithubPolling();
  useProviderRefreshOnFocus();
  useUpdaterPolling();
  useWindowPresence();
  useZoomShortcuts();
  useEscapeToCloseDialog();

  // Stateless overlay-open listeners (all with empty deps) registered under one hook:
  // each handler only touches stable setters or reads fresh state via useAppStore.getState().
  // Moved verbatim — no open/close behavior changed.
  useEffect(() => {
    const onOpenSettings = (event: Event) => {
      const detail = (event as CustomEvent<{ section?: string }>).detail;
      setWorkflowStudioOpen(false);
      setGithubStudioOpen(false);
      setProviderStudioOpen(false);
      setBudgetStudioOpen(false);
      setLinearStudioOpen(false);
      setSentryStudioOpen(false);
      setGitlabStudioOpen(false);
      setGuideStudioOpen(false);
      setAddWorkspaceOpen(false);
      setSwitcherOpen(false);
      setAppSettingsFocus(detail?.section);
      setAppSettingsOpen(true);
    };
    const onOpenGuide = () => {
      setWorkflowStudioOpen(false);
      setGithubStudioOpen(false);
      setProviderStudioOpen(false);
      setBudgetStudioOpen(false);
      setLinearStudioOpen(false);
      setSentryStudioOpen(false);
      setGitlabStudioOpen(false);
      setAppSettingsOpen(false);
      setAddWorkspaceOpen(false);
      setSwitcherOpen(false);
      setGuideStudioOpen(true);
    };
    const onOpenGithubStudio = (event: Event) => {
      const detail = (
        event as CustomEvent<{ sessionId?: SessionId; prNumber?: number; threadId?: string }>
      ).detail;
      setWorkflowStudioOpen(false);
      setProviderStudioOpen(false);
      setBudgetStudioOpen(false);
      setLinearStudioOpen(false);
      setSentryStudioOpen(false);
      setGitlabStudioOpen(false);
      setAppSettingsOpen(false);
      setGuideStudioOpen(false);
      setAddWorkspaceOpen(false);
      setSwitcherOpen(false);
      setGithubStudioSession(detail?.sessionId ?? null);
      setGithubStudioPrNumber(detail?.prNumber ?? null);
      setGithubStudioThreadId(detail?.threadId ?? null);
      setGithubStudioOpen(true);
    };
    const onOpenPlanStudio = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId?: SessionId; planId?: PlanId }>).detail;
      if (!detail?.sessionId) {
        return;
      }
      setNewSessionOpen(false);
      setWorkspaceSettingsOpen(false);
      setWorkspaceSettingsFocus(undefined);
      setSessionSettingsOpen(false);
      const state = useAppStore.getState();
      state.setFocusedPlanId(detail.sessionId, detail.planId ?? null);
      state.setActiveLens(detail.sessionId, 'plans');
    };
    const onOpenDiffViewer = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId?: SessionId; workingDir?: string }>).detail;
      if (!detail?.sessionId) {
        return;
      }
      setNewSessionOpen(false);
      setWorkspaceSettingsOpen(false);
      setWorkspaceSettingsFocus(undefined);
      setSessionSettingsOpen(false);
      useAppStore.getState().setActiveLens(detail.sessionId, 'files');
    };
    const onOpenProviderStudio = (event: Event) => {
      const detail = (
        event as CustomEvent<{ providerId?: ProviderId; action?: ProviderLifecycleAction }>
      ).detail;
      setWorkflowStudioOpen(false);
      setGithubStudioOpen(false);
      setBudgetStudioOpen(false);
      setLinearStudioOpen(false);
      setSentryStudioOpen(false);
      setGitlabStudioOpen(false);
      setAppSettingsOpen(false);
      setGuideStudioOpen(false);
      setAddWorkspaceOpen(false);
      setSwitcherOpen(false);
      setProviderStudioFocus(detail?.providerId ?? null);
      setProviderStudioAction(detail?.action ?? null);
      setProviderStudioOpen(true);
    };
    const onOpenBudgetStudio = (event: Event) => {
      const detail = (event as CustomEvent<{ scope?: BudgetScope }>).detail;
      setWorkflowStudioOpen(false);
      setGithubStudioOpen(false);
      setProviderStudioOpen(false);
      setLinearStudioOpen(false);
      setSentryStudioOpen(false);
      setGitlabStudioOpen(false);
      setAppSettingsOpen(false);
      setGuideStudioOpen(false);
      setAddWorkspaceOpen(false);
      setSwitcherOpen(false);
      setBudgetStudioScope(detail?.scope);
      setBudgetStudioOpen(true);
    };
    const onOpenLinearStudio = (event: Event) => {
      const detail = (event as CustomEvent<{ issueExternalId?: string }>).detail;
      setWorkflowStudioOpen(false);
      setGithubStudioOpen(false);
      setProviderStudioOpen(false);
      setBudgetStudioOpen(false);
      setSentryStudioOpen(false);
      setGitlabStudioOpen(false);
      setAppSettingsOpen(false);
      setGuideStudioOpen(false);
      setAddWorkspaceOpen(false);
      setSwitcherOpen(false);
      setLinearStudioFocus(detail?.issueExternalId ?? null);
      setLinearStudioOpen(true);
    };
    const onOpenSentryStudio = (event: Event) => {
      const detail = (event as CustomEvent<{ issueExternalId?: string }>).detail;
      setWorkflowStudioOpen(false);
      setGithubStudioOpen(false);
      setProviderStudioOpen(false);
      setBudgetStudioOpen(false);
      setLinearStudioOpen(false);
      setGitlabStudioOpen(false);
      setAppSettingsOpen(false);
      setGuideStudioOpen(false);
      setAddWorkspaceOpen(false);
      setSwitcherOpen(false);
      setSentryStudioFocus(detail?.issueExternalId ?? null);
      setSentryStudioOpen(true);
    };
    const onOpenGitlabStudio = (event: Event) => {
      const detail = (event as CustomEvent<{ issueExternalId?: string }>).detail;
      setWorkflowStudioOpen(false);
      setGithubStudioOpen(false);
      setProviderStudioOpen(false);
      setBudgetStudioOpen(false);
      setLinearStudioOpen(false);
      setSentryStudioOpen(false);
      setAppSettingsOpen(false);
      setGuideStudioOpen(false);
      setAddWorkspaceOpen(false);
      setSwitcherOpen(false);
      setGitlabStudioFocus(detail?.issueExternalId ?? null);
      setGitlabStudioOpen(true);
    };
    const onRevealChat = () => {
      setNewSessionOpen(false);
      setWorkspaceSettingsOpen(false);
      setWorkspaceSettingsFocus(undefined);
      setSessionSettingsOpen(false);
      const state = useAppStore.getState();
      const sid = state.currentSessionId;
      if (sid) {
        state.setSessionStudio(sid, null);
        state.setActiveLens(sid, null);
      }
    };
    const onAddWorkspace = () => setAddWorkspaceOpen(true);
    const onOpenSwitcher = () => setSwitcherOpen(true);
    const onPairDevice = () => setCompanionOpen(true);

    window.addEventListener('goodboy:open-settings', onOpenSettings);
    window.addEventListener('goodboy:open-guide', onOpenGuide);
    window.addEventListener('goodboy:open-github-studio', onOpenGithubStudio);
    window.addEventListener('goodboy:open-plan-studio', onOpenPlanStudio);
    window.addEventListener('goodboy:open-diff-viewer', onOpenDiffViewer);
    window.addEventListener('goodboy:open-provider-studio', onOpenProviderStudio);
    window.addEventListener('goodboy:open-budget-studio', onOpenBudgetStudio);
    window.addEventListener('goodboy:open-linear-studio', onOpenLinearStudio);
    window.addEventListener('goodboy:open-sentry-studio', onOpenSentryStudio);
    window.addEventListener('goodboy:open-gitlab-studio', onOpenGitlabStudio);
    window.addEventListener('goodboy:reveal-chat', onRevealChat);
    window.addEventListener('goodboy:add-workspace', onAddWorkspace);
    window.addEventListener('goodboy:open-workspace-switcher', onOpenSwitcher);
    window.addEventListener('goodboy:open-pair-device', onPairDevice);
    return () => {
      window.removeEventListener('goodboy:open-settings', onOpenSettings);
      window.removeEventListener('goodboy:open-guide', onOpenGuide);
      window.removeEventListener('goodboy:open-github-studio', onOpenGithubStudio);
      window.removeEventListener('goodboy:open-plan-studio', onOpenPlanStudio);
      window.removeEventListener('goodboy:open-diff-viewer', onOpenDiffViewer);
      window.removeEventListener('goodboy:open-provider-studio', onOpenProviderStudio);
      window.removeEventListener('goodboy:open-budget-studio', onOpenBudgetStudio);
      window.removeEventListener('goodboy:open-linear-studio', onOpenLinearStudio);
      window.removeEventListener('goodboy:open-sentry-studio', onOpenSentryStudio);
      window.removeEventListener('goodboy:open-gitlab-studio', onOpenGitlabStudio);
      window.removeEventListener('goodboy:reveal-chat', onRevealChat);
      window.removeEventListener('goodboy:add-workspace', onAddWorkspace);
      window.removeEventListener('goodboy:open-workspace-switcher', onOpenSwitcher);
      window.removeEventListener('goodboy:open-pair-device', onPairDevice);
    };
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ section?: string }>).detail;
      if (workspaceSettingsOpen && detail?.section === undefined) {
        setWorkspaceSettingsOpen(false);
        setWorkspaceSettingsFocus(undefined);
        return;
      }
      setWorkspaceSettingsFocus(detail?.section);
      setSessionSettingsOpen(false);
      setNewSessionOpen(false);
      clearSessionStudio();
      setWorkspaceSettingsOpen(true);
    };
    window.addEventListener('goodboy:open-workspace-settings', handler);
    return () => window.removeEventListener('goodboy:open-workspace-settings', handler);
  }, [workspaceSettingsOpen, clearSessionStudio]);

  useEffect(() => {
    const handler = () => {
      if (sessionSettingsOpen) {
        setSessionSettingsOpen(false);
        return;
      }
      setWorkspaceSettingsOpen(false);
      setWorkspaceSettingsFocus(undefined);
      setNewSessionOpen(false);
      clearSessionStudio();
      setSessionSettingsOpen(true);
    };
    window.addEventListener('goodboy:open-session-settings', handler);
    return () => window.removeEventListener('goodboy:open-session-settings', handler);
  }, [sessionSettingsOpen, clearSessionStudio]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (
        event as CustomEvent<{ sessionId?: SessionId; prNumber?: number; threadId?: string }>
      ).detail;
      if (!detail?.sessionId) {
        return;
      }
      setNewSessionOpen(false);
      setWorkspaceSettingsOpen(false);
      setWorkspaceSettingsFocus(undefined);
      setSessionSettingsOpen(false);
      setSessionStudio(detail.sessionId, {
        kind: 'github',
        prNumber: detail.prNumber,
        threadId: detail.threadId,
      });
    };
    window.addEventListener('goodboy:open-github-session', handler);
    return () => window.removeEventListener('goodboy:open-github-session', handler);
  }, [setSessionStudio]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId?: SessionId }>).detail;
      if (!detail?.sessionId) {
        return;
      }
      setNewSessionOpen(false);
      setWorkspaceSettingsOpen(false);
      setWorkspaceSettingsFocus(undefined);
      setSessionSettingsOpen(false);
      setSessionStudio(detail.sessionId, { kind: 'mr' });
    };
    window.addEventListener('goodboy:open-gitlab-mr', handler);
    return () => window.removeEventListener('goodboy:open-gitlab-mr', handler);
  }, [setSessionStudio]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId?: SessionId }>).detail;
      if (detail?.sessionId) {
        setWorkspaceSettingsOpen(false);
        setWorkspaceSettingsFocus(undefined);
        setSessionSettingsOpen(false);
        setNewSessionOpen(false);
        setSessionStudio(detail.sessionId, { kind: 'workflow' });
      }
    };
    window.addEventListener('goodboy:open-workflow-builder', handler);
    return () => window.removeEventListener('goodboy:open-workflow-builder', handler);
  }, [setSessionStudio]);

  useEffect(() => {
    const handler = () => {
      if (!currentWorkspace) {
        return;
      }
      setWorkspaceSettingsOpen(false);
      setWorkspaceSettingsFocus(undefined);
      setSessionSettingsOpen(false);
      clearSessionStudio();
      setNewSessionOpen(true);
    };
    window.addEventListener('goodboy:new-session', handler);
    return () => window.removeEventListener('goodboy:new-session', handler);
  }, [currentWorkspace, clearSessionStudio]);

  useEffect(() => {
    let off: (() => void) | undefined;
    let cancelled = false;
    void listenBridgeCommands().then((fn) => {
      if (cancelled) {
        fn();
        return;
      }
      off = fn;
    });
    return () => {
      cancelled = true;
      off?.();
    };
  }, []);

  useEffect(() => {
    setKeepAliveIds([]);
  }, [currentWorkspace?.id]);

  useEffect(() => {
    setSessionSettingsOpen(false);
  }, [currentSession?.id]);

  useEffect(() => {
    setWorkspaceSettingsOpen(false);
    setNewSessionOpen(false);
  }, [currentWorkspace?.id]);

  useEffect(() => {
    const id = currentSession?.id ?? null;
    if (!id) {
      return;
    }
    setKeepAliveIds((prev) => {
      if (prev[prev.length - 1] === id) {
        return prev;
      }
      const filtered = prev.filter((x) => x !== id);
      const next = [...filtered, id];
      return next.length > KEEP_ALIVE_CAP ? next.slice(next.length - KEEP_ALIVE_CAP) : next;
    });
  }, [currentSession?.id]);

  const closeAllStudios = useCallback(() => {
    setWorkflowStudioOpen(false);
    setGithubStudioOpen(false);
    setProviderStudioOpen(false);
    setBudgetStudioOpen(false);
    setLinearStudioOpen(false);
    setSentryStudioOpen(false);
    setGitlabStudioOpen(false);
    setAppSettingsOpen(false);
    setGuideStudioOpen(false);
    setAddWorkspaceOpen(false);
    setSwitcherOpen(false);
  }, []);

  const activeStudio: string | null = workflowStudioOpen
    ? 'workflow'
    : githubStudioOpen
      ? 'github'
      : providerStudioOpen
        ? 'provider'
        : budgetStudioOpen
          ? 'budget'
          : linearStudioOpen
            ? 'linear'
            : sentryStudioOpen
              ? 'sentry'
              : gitlabStudioOpen
                ? 'gitlab'
                : appSettingsOpen
                  ? 'settings'
                  : guideStudioOpen
                    ? 'guide'
                    : null;

  const openSettings = useCallback(() => {
    closeAllStudios();
    clearSessionStudio();
    setAppSettingsFocus(undefined);
    setAppSettingsOpen(true);
  }, [closeAllStudios, clearSessionStudio]);
  const openDeleteSession = useCallback(() => {
    if (currentSession) {
      setDeleteOpen(true);
    }
  }, [currentSession]);
  const openArchiveSession = useCallback(() => {
    if (currentSession) {
      setArchiveOpen(true);
    }
  }, [currentSession]);

  useEffect(() => {
    const handler = () => {
      if (currentSession) {
        setDeleteOpen(true);
      }
    };
    window.addEventListener('goodboy:delete-session', handler);
    return () => window.removeEventListener('goodboy:delete-session', handler);
  }, [currentSession]);

  useEffect(() => {
    const handler = () => {
      if (currentSession) {
        setArchiveOpen(true);
      }
    };
    window.addEventListener('goodboy:archive-session', handler);
    return () => window.removeEventListener('goodboy:archive-session', handler);
  }, [currentSession]);
  const openShortcutHelp = useCallback(() => {
    setAppSettingsFocus('shortcuts');
    setAppSettingsOpen(true);
  }, []);
  const openPalette = useCallback((prefix = '') => {
    setPalettePrefix(prefix);
    setPaletteOpen(true);
    markStepComplete('palette');
  }, []);
  const openWorkspace = useAppStore((s) => s.openWorkspace);
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
  const lensGo = useAppStore((s) => s.lensGo);
  const currentWorkspaceSessions = useSessions();

  const selectWorkspaceByIndex = useCallback(
    (idx: number) => {
      const w = workspaces[idx];
      if (w) {
        void openWorkspace(w.id, w.name);
      }
    },
    [workspaces, openWorkspace],
  );

  const navigateSession = useCallback(
    (delta: number) => {
      const list = currentWorkspaceSessions;
      if (list.length === 0) {
        return;
      }
      if (!currentSession) {
        const target = delta >= 0 ? list[0] : list[list.length - 1];
        if (target) {
          void setCurrentSession(target.id);
        }
        return;
      }
      const idx = list.findIndex((s) => s.id === currentSession.id);
      if (idx === -1) {
        return;
      }
      const next = list[idx + delta];
      if (next) {
        void setCurrentSession(next.id);
      }
    },
    [currentWorkspaceSessions, currentSession, setCurrentSession],
  );

  const navigateLens = useCallback(
    (delta: number) => {
      if (currentSession) {
        lensGo(currentSession.id, delta);
      }
    },
    [currentSession, lensGo],
  );

  const openNewSession = useCallback(() => {
    if (!currentWorkspace) {
      return;
    }
    window.dispatchEvent(new CustomEvent('goodboy:new-session'));
  }, [currentWorkspace]);

  const openModelPicker = useCallback(() => {
    window.dispatchEvent(new CustomEvent('goodboy:open-model-picker'));
  }, []);

  const openPermissionPicker = useCallback(() => {
    window.dispatchEvent(new CustomEvent('goodboy:open-permission-picker'));
  }, []);

  const currentSessionId = useAppStore((s) => s.currentSessionId);
  const sessionWorktrees = useAppStore((s) => s.sessionWorktrees);

  const commitDiffLoader = useCallback(async () => {
    if (!commitDiff) {
      return '';
    }
    const worktree = currentSessionId ? (sessionWorktrees[currentSessionId]?.[0] ?? null) : null;
    if (worktree) {
      try {
        return await worktreeDiffCommit(worktree, commitDiff.sha);
      } catch {
        void 0;
      }
    }
    return ghCommitDiff(commitDiff.repo, commitDiff.sha);
  }, [commitDiff, currentSessionId, sessionWorktrees]);

  useKeyboardShortcut('cmd+,', openSettings);
  useKeyboardShortcut('cmd+/', openShortcutHelp);
  useKeyboardShortcut('cmd+.', openDeleteSession);
  useKeyboardShortcut('cmd+shift+a', openArchiveSession);
  useKeyboardShortcut('cmd+k', () => openPalette());
  useKeyboardShortcut('cmd+o', () => setSwitcherOpen(true));
  useKeyboardShortcut('cmd+n', openNewSession, { ignoreInInputs: false });
  useKeyboardShortcut('cmd+[', () => navigateLens(-1), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+]', () => navigateLens(1), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+shift+[', () => navigateSession(-1), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+shift+]', () => navigateSession(1), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+shift+k', openModelPicker);
  useKeyboardShortcut('cmd+shift+p', openPermissionPicker);
  useKeyboardShortcut('cmd+1', () => selectWorkspaceByIndex(0), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+2', () => selectWorkspaceByIndex(1), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+3', () => selectWorkspaceByIndex(2), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+4', () => selectWorkspaceByIndex(3), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+5', () => selectWorkspaceByIndex(4), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+6', () => selectWorkspaceByIndex(5), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+7', () => selectWorkspaceByIndex(6), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+8', () => selectWorkspaceByIndex(7), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+9', () => selectWorkspaceByIndex(8), { ignoreInInputs: false });
  // Hidden pairing surface — undocumented on purpose, no menu/help entry.
  useKeyboardShortcut('cmd+ctrl+shift+m', () => setCompanionOpen((v) => !v), {
    ignoreInInputs: false,
  });

  const renderedSessionIds = useMemo<ReadonlyArray<SessionId>>(() => {
    const cid = currentSession?.id ?? null;
    if (!cid) {
      return keepAliveIds;
    }
    if (keepAliveIds.includes(cid)) {
      return keepAliveIds;
    }
    const merged = [...keepAliveIds, cid];
    return merged.length > KEEP_ALIVE_CAP ? merged.slice(merged.length - KEEP_ALIVE_CAP) : merged;
  }, [keepAliveIds, currentSession?.id]);

  const deferredRenderedIds = useDeferredValue(renderedSessionIds);
  const deferredActiveId = useDeferredValue(currentSession?.id ?? null);

  if (!hydrated || !splashFinished) {
    return (
      <BootSplash
        phase={bootPhase}
        error={error}
        onRetry={() => void hydrate()}
        onFinished={() => setSplashFinished(true)}
      />
    );
  }

  if (hasWorkspaces && !currentWorkspace && isMainWindow() && !addWorkspaceOpen) {
    return (
      <ToastProvider>
        <NotificationToastBridge />
        <WorkspaceLauncher />
        {switcherOpen ? <WorkspaceSwitcher onClose={() => setSwitcherOpen(false)} /> : null}
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <NotificationToastBridge />
      <AppShell
        topBar={<AppTopBar onOpenSettings={openSettings} activeStudio={activeStudio} />}
        footer={
          currentWorkspace ? (
            <AppFooter
              activeStudio={activeStudio}
              linearEnabled={hasLinear}
              sentryEnabled={hasSentry}
              gitlabEnabled={hasGitlab}
              onOpenWorkflows={() => {
                closeAllStudios();
                setWorkflowStudioOpen(true);
              }}
              onOpenProviders={() => {
                closeAllStudios();
                setProviderStudioFocus(null);
                setProviderStudioAction(null);
                setProviderStudioOpen(true);
              }}
              onOpenBudget={() => {
                closeAllStudios();
                setBudgetStudioScope({ kind: 'overview' });
                setBudgetStudioOpen(true);
              }}
              onOpenGithub={() => {
                closeAllStudios();
                setGithubStudioSession(currentSession?.id ?? null);
                setGithubStudioOpen(true);
              }}
              onOpenLinear={() => {
                closeAllStudios();
                setLinearStudioFocus(null);
                setLinearStudioOpen(true);
              }}
              onOpenSentry={() => {
                closeAllStudios();
                setSentryStudioFocus(null);
                setSentryStudioOpen(true);
              }}
              onOpenGitlab={() => {
                closeAllStudios();
                setGitlabStudioFocus(null);
                setGitlabStudioOpen(true);
              }}
            />
          ) : undefined
        }
        leftHidden={!currentSession}
        leftSidebar={hasWorkspaces ? <WorkspacesSidebar /> : undefined}
        main={
          <div className="relative h-full w-full">
            {error ? (
              <p className="p-6 text-sm text-danger">init error: {error}</p>
            ) : currentSession ? (
              <div className="relative h-full w-full">
                {deferredRenderedIds.map((id) => (
                  <KeepAliveWorkSurface
                    key={id}
                    sessionId={id}
                    isActive={id === deferredActiveId}
                  />
                ))}
              </div>
            ) : currentWorkspace ? (
              <StageBoard
                workspaceId={currentWorkspace.id}
                sessions={currentWorkspaceSessions}
                onCreateSession={openNewSession}
              />
            ) : (
              <NoWorkspaceScreen onAddWorkspace={() => setAddWorkspaceOpen(true)} />
            )}

            <OnboardingCard />
          </div>
        }
        rightSidebar={null}
        overlay={
          newSessionOpen && currentWorkspace ? (
            <NewSessionView
              workspaceId={currentWorkspace.id}
              onClose={() => setNewSessionOpen(false)}
              onOpenSettings={() => {
                setNewSessionOpen(false);
                openSettings();
              }}
            />
          ) : workspaceSettingsOpen && currentWorkspace ? (
            <WorkspaceSettingsPane
              workspaceId={currentWorkspace.id}
              workspaceName={currentWorkspace.name}
              initialSection={workspaceSettingsFocus}
              onClose={() => {
                setWorkspaceSettingsOpen(false);
                setWorkspaceSettingsFocus(undefined);
              }}
            />
          ) : sessionSettingsOpen && currentSession ? (
            <SessionSettingsPane
              session={currentSession}
              onClose={() => setSessionSettingsOpen(false)}
            />
          ) : undefined
        }
      />

      {appSettingsOpen ? (
        <SettingsStudio
          initialFocus={appSettingsFocus}
          onClose={() => {
            setAppSettingsOpen(false);
            setAppSettingsFocus(undefined);
          }}
        />
      ) : null}
      {guideStudioOpen ? <GuideStudio onClose={() => setGuideStudioOpen(false)} /> : null}
      {paletteOpen ? (
        <CommandPalette
          initialQuery={palettePrefix}
          onClose={() => setPaletteOpen(false)}
          onOpenSettings={() => {
            openSettings();
            setPaletteOpen(false);
          }}
          onNewSession={() => setPaletteOpen(false)}
          onOpenShortcutHelp={() => {
            openShortcutHelp();
            setPaletteOpen(false);
          }}
        />
      ) : null}
      {addWorkspaceOpen ? (
        <WorkspaceLinkDialog open onClose={() => setAddWorkspaceOpen(false)} />
      ) : null}
      {workflowStudioOpen && currentWorkspace ? (
        <WorkflowStudio
          workspaceId={currentWorkspace.id}
          workspaceName={currentWorkspace.name}
          onClose={() => setWorkflowStudioOpen(false)}
        />
      ) : null}
      {githubStudioOpen && currentWorkspace ? (
        <GitHubStudio
          workspaceName={currentWorkspace.name}
          initialSessionId={githubStudioSession}
          initialPrNumber={githubStudioPrNumber}
          initialThreadId={githubStudioThreadId}
          onClose={() => setGithubStudioOpen(false)}
        />
      ) : null}
      {providerStudioOpen && currentWorkspace ? (
        <ProviderStudio
          workspaceName={currentWorkspace.name}
          initialFocus={providerStudioFocus}
          initialAction={providerStudioAction}
          onClose={() => {
            setProviderStudioOpen(false);
            setProviderStudioAction(null);
          }}
        />
      ) : null}
      {budgetStudioOpen && currentWorkspace ? (
        <BudgetStudio
          workspaceName={currentWorkspace.name}
          initialScope={budgetStudioScope}
          onClose={() => setBudgetStudioOpen(false)}
        />
      ) : null}
      {linearStudioOpen && currentWorkspace ? (
        <LinearStudio
          workspaceId={currentWorkspace.id}
          workspaceName={currentWorkspace.name}
          initialIssueId={linearStudioFocus}
          onClose={() => setLinearStudioOpen(false)}
        />
      ) : null}
      {sentryStudioOpen && currentWorkspace ? (
        <SentryStudio
          workspaceId={currentWorkspace.id}
          workspaceName={currentWorkspace.name}
          initialIssueId={sentryStudioFocus}
          onClose={() => setSentryStudioOpen(false)}
        />
      ) : null}
      {gitlabStudioOpen && currentWorkspace ? (
        <GitlabStudio
          workspaceId={currentWorkspace.id}
          workspaceName={currentWorkspace.name}
          initialIssueId={gitlabStudioFocus}
          onClose={() => setGitlabStudioOpen(false)}
        />
      ) : null}
      {commitDiff ? (
        <DiffViewerDialog
          open
          onClose={() => setCommitDiff(null)}
          title={`commit ${commitDiff.sha.slice(0, 7)}`}
          loader={commitDiffLoader}
        />
      ) : null}
      {currentSession && deleteOpen ? (
        <DeleteSessionDialog session={currentSession} open onClose={() => setDeleteOpen(false)} />
      ) : null}
      {currentSession && archiveOpen ? (
        <ArchiveSessionDialog session={currentSession} open onClose={() => setArchiveOpen(false)} />
      ) : null}
      {switcherOpen ? <WorkspaceSwitcher onClose={() => setSwitcherOpen(false)} /> : null}

      {companionOpen ? <CompanionStudio onClose={() => setCompanionOpen(false)} /> : null}

      <OnboardingWizard />
    </ToastProvider>
  );
};
