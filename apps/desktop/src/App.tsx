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
import { DeleteSessionConfirm } from './features/session/components/DeleteSessionConfirm';
import { ArchiveSessionConfirm } from './features/session/components/ArchiveSessionConfirm';
import { SettingsStudio } from './features/settings/components/SettingsStudio';
import { GuideStudio } from './features/settings/components/GuideStudio';
import { WorkspaceSettingsPane } from './features/workspace/components/WorkspaceSettingsPane';
import { ToastProvider } from './app/components/Toast';
import { NotificationToastBridge } from './features/notifications/components/NotificationToastBridge';
import { WorkspacesSidebar } from './features/workspace/components/WorkspacesSidebar';
import { SidebarPeekOverlay } from './features/workspace/components/SidebarPeekOverlay';
import { useWindowPresence } from './features/workspace/hooks/useWindowPresence';
import { WorkspaceLinkDialog } from './features/workspace/components/WorkspaceLinkDialog';
import { ConvertWorkspaceDialog } from './features/workspace/components/ConvertWorkspaceDialog';
import { WorkspaceLauncher } from './features/workspace/components/WorkspaceLauncher';
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
import { ImpactStudio } from './features/impact/components/ImpactStudio';
import { DiffViewerDialog } from './features/permissions/components/DiffViewerDialog';
import { ghCommitDiff } from './features/github/github';
import { worktreeDiffCommit } from './features/worktree/worktree';
import { OnboardingCard } from './features/onboarding/OnboardingCard';
import { OnboardingWizard } from './features/onboarding/OnboardingWizard';
import { CompanionStudio } from './features/companion/CompanionStudio';
import { listenBridgeCommands } from './features/companion/commandExecutor';
import { markStepComplete } from './features/onboarding/onboarding-store';
import { disposeTerminalPty } from './features/terminal/closeTab';
import { useKeyboardShortcut } from './shared/hooks/useKeyboardShortcut';
import { useProviderRefreshOnFocus } from './shared/hooks/useProviderRefreshOnFocus';
import { useZoomShortcuts } from './shared/hooks/useZoomShortcuts';
import { useEscapeToCloseDialog } from './shared/hooks/useEscapeToCloseDialog';
import { useCommitLinkInterceptor } from './shared/hooks/useCommitLinkInterceptor';
import { isBranchlessSession } from './shared/utils/isBranchlessSession';
import {
  useAppStore,
  useCurrentSession,
  useCurrentWorkspace,
  useSessions,
  useWorkspaces,
  type LensKind,
} from './store';
import { useGithubPolling } from './features/github/hooks/useGithubPolling';
import { useUpdaterPolling } from './features/updater/hooks/useUpdaterPolling';
import { useWorkspaceRemoteHostKind } from './features/worktree/useWorkspaceRemoteHostKind';
import { resolveSessionRepo } from './store/slices/worktrees/resolveSessionRepo';
import { useSessionSidebarVisibility } from './features/workspace/hooks/useSessionSidebarVisibility';

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
  const hasActiveSession = currentSession != null;
  const sessionSidebar = useSessionSidebarVisibility({ hasActiveSession });
  const remoteKind = useWorkspaceRemoteHostKind({ workspaceId: currentWorkspace?.id ?? null });
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [palettePrefix, setPalettePrefix] = useState('');
  const [addWorkspaceOpen, setAddWorkspaceOpen] = useState(false);
  const [convertWorkspaceOpen, setConvertWorkspaceOpen] = useState(false);
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
  const [githubStudioIssueId, setGithubStudioIssueId] = useState<string | null>(null);
  const [budgetStudioOpen, setBudgetStudioOpen] = useState(false);
  const [budgetStudioScope, setBudgetStudioScope] = useState<BudgetScope | undefined>(undefined);
  const [impactStudioOpen, setImpactStudioOpen] = useState(false);
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
      setGuideStudioOpen(true);
    };
    const onOpenGithubStudio = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          sessionId?: SessionId;
          prNumber?: number;
          threadId?: string;
          issueExternalId?: string;
        }>
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
      setGithubStudioSession(detail?.sessionId ?? null);
      setGithubStudioPrNumber(detail?.prNumber ?? null);
      setGithubStudioThreadId(detail?.threadId ?? null);
      setGithubStudioIssueId(detail?.issueExternalId ?? null);
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
      setProviderStudioFocus(detail?.providerId ?? null);
      setProviderStudioAction(detail?.action ?? null);
      setProviderStudioOpen(true);
    };
    const onOpenBudgetStudio = (event: Event) => {
      const detail = (event as CustomEvent<{ scope?: BudgetScope }>).detail;
      setWorkflowStudioOpen(false);
      setGithubStudioOpen(false);
      setProviderStudioOpen(false);
      setImpactStudioOpen(false);
      setLinearStudioOpen(false);
      setSentryStudioOpen(false);
      setGitlabStudioOpen(false);
      setAppSettingsOpen(false);
      setGuideStudioOpen(false);
      setAddWorkspaceOpen(false);
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
      setGitlabStudioFocus(detail?.issueExternalId ?? null);
      setGitlabStudioOpen(true);
    };
    const onRevealChat = () => {
      setNewSessionOpen(false);
      setWorkspaceSettingsOpen(false);
      setWorkspaceSettingsFocus(undefined);
      const state = useAppStore.getState();
      const sid = state.currentSessionId;
      if (sid) {
        state.setSessionStudio(sid, null);
      }
    };
    const onAddWorkspace = () => setAddWorkspaceOpen(true);
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
      setNewSessionOpen(false);
      clearSessionStudio();
      setWorkspaceSettingsOpen(true);
    };
    window.addEventListener('goodboy:open-workspace-settings', handler);
    return () => window.removeEventListener('goodboy:open-workspace-settings', handler);
  }, [workspaceSettingsOpen, clearSessionStudio]);

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
      clearSessionStudio();
      setGithubStudioOpen(false);
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
    setImpactStudioOpen(false);
    setLinearStudioOpen(false);
    setSentryStudioOpen(false);
    setGitlabStudioOpen(false);
    setAppSettingsOpen(false);
    setGuideStudioOpen(false);
    setAddWorkspaceOpen(false);
  }, []);

  const activeStudio: string | null = workflowStudioOpen
    ? 'workflow'
    : githubStudioOpen
      ? 'github'
      : providerStudioOpen
        ? 'provider'
        : budgetStudioOpen
          ? 'budget'
          : impactStudioOpen
            ? 'impact'
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
  const openBudget = useCallback(() => {
    closeAllStudios();
    setBudgetStudioScope({ kind: 'overview' });
    setBudgetStudioOpen(true);
  }, [closeAllStudios]);
  const openImpact = useCallback(() => {
    closeAllStudios();
    setImpactStudioOpen(true);
  }, [closeAllStudios]);
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

  const goToLens = useCallback((kind: LensKind | null) => {
    const s = useAppStore.getState();
    if (!s.currentSessionId) {
      return;
    }
    s.setActiveLens(s.currentSessionId, kind);
  }, []);

  const goToDiffOrExploreLens = useCallback(() => {
    const store = useAppStore.getState();
    const sessionId = store.currentSessionId;
    if (sessionId == null) {
      return;
    }
    const session = store.sessions.find((candidate) => candidate.id === sessionId);
    if (session == null) {
      store.setActiveLens(sessionId, 'files');
      return;
    }
    const workspace = store.workspaces.find((candidate) => candidate.id === session.workspaceId);
    const isBranchless = isBranchlessSession({
      workspaceKind: workspace?.kind,
      branch: store.sessionBranches[sessionId],
    });
    store.setActiveLens(sessionId, isBranchless ? 'explore' : 'files');
  }, []);

  const toggleTerminalLens = useCallback(() => {
    const s = useAppStore.getState();
    const id = s.currentSessionId;
    if (!id) {
      return;
    }
    s.setActiveLens(id, s.activeLens[id] === 'terminal' ? null : 'terminal');
  }, []);

  const openNewTerminalTab = useCallback(() => {
    const s = useAppStore.getState();
    const id = s.currentSessionId;
    if (!id || s.activeLens[id] !== 'terminal') {
      return;
    }
    s.addTerminalTab(id, s.sessionWorktrees[id]?.[0] ?? null);
  }, []);

  const closeActiveTerminalTab = useCallback(() => {
    const s = useAppStore.getState();
    const id = s.currentSessionId;
    if (!id || s.activeLens[id] !== 'terminal') {
      return;
    }
    const tabId = s.activeTerminalTab[id];
    if (!tabId) {
      return;
    }
    disposeTerminalPty(tabId);
    s.closeTerminalTab(id, tabId);
  }, []);

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
  const currentSessionWorktree = useAppStore((state) =>
    currentSessionId == null
      ? null
      : (resolveSessionRepo({ state, sessionId: currentSessionId })?.worktreePath ?? null),
  );

  const commitDiffLoader = useCallback(async () => {
    if (!commitDiff) {
      return '';
    }
    if (currentSessionWorktree != null) {
      try {
        return await worktreeDiffCommit(currentSessionWorktree, commitDiff.sha);
      } catch (error) {
        if (commitDiff.repo === '') {
          throw error;
        }
      }
    }
    return ghCommitDiff(commitDiff.repo, commitDiff.sha);
  }, [commitDiff, currentSessionWorktree]);

  useKeyboardShortcut('cmd+,', openSettings);
  useKeyboardShortcut('cmd+/', openShortcutHelp);
  useKeyboardShortcut('cmd+.', openDeleteSession);
  useKeyboardShortcut('cmd+shift+a', openArchiveSession);
  useKeyboardShortcut('cmd+k', () => openPalette());
  useKeyboardShortcut('cmd+o', () =>
    window.dispatchEvent(new CustomEvent('goodboy:open-workspace-switcher')),
  );
  useKeyboardShortcut('cmd+n', openNewSession, { ignoreInInputs: false });
  useKeyboardShortcut('cmd+b', sessionSidebar.toggle, { ignoreInInputs: false });
  useKeyboardShortcut('cmd+[', () => navigateLens(-1), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+]', () => navigateLens(1), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+shift+[', () => navigateSession(-1), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+shift+]', () => navigateSession(1), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+shift+k', openModelPicker);
  useKeyboardShortcut('cmd+shift+p', openPermissionPicker);
  useKeyboardShortcut('cmd+j', toggleTerminalLens, { ignoreInInputs: false });
  useKeyboardShortcut('cmd+t', openNewTerminalTab, { ignoreInInputs: false });
  useKeyboardShortcut('cmd+w', closeActiveTerminalTab, { ignoreInInputs: false });
  useKeyboardShortcut('cmd+shift+g', () => goToLens('goal'), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+shift+w', () => goToLens('workflows'), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+shift+b', () => goToLens('agents'), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+shift+r', () => goToLens('resolve'), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+shift+d', goToDiffOrExploreLens, { ignoreInInputs: false });
  useKeyboardShortcut('cmd+shift+l', () => goToLens('plans'), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+shift+s', () => goToLens('scripts'), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+shift+q', () => goToLens('questions'), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+shift+o', () => goToLens(null), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+shift+h', () => goToLens('pr'), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+shift+e', () => goToLens('decisions'), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+shift+u', () => goToLens('last_output_summary'), {
    ignoreInInputs: false,
  });
  useKeyboardShortcut('cmd+shift+escape', () => void setCurrentSession(null), {
    ignoreInInputs: false,
  });
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
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <NotificationToastBridge />
      <AppShell
        topBar={
          <AppTopBar
            onOpenSettings={openSettings}
            onOpenBudget={openBudget}
            activeStudio={activeStudio}
            hasWorkspace={currentWorkspace != null}
            hasActiveSession={hasActiveSession}
            isSessionSidebarCollapsed={sessionSidebar.isCollapsed}
            isSessionSidebarPeeking={sessionSidebar.isPeeking}
            onToggleSessionSidebar={
              sessionSidebar.isCollapsed ? sessionSidebar.pin : sessionSidebar.toggle
            }
            onSessionSidebarAnchorEnter={() => sessionSidebar.requestPeek({ source: 'anchor' })}
            onSessionSidebarAnchorLeave={() => {
              sessionSidebar.cancelPeek();
              sessionSidebar.scheduleClose();
            }}
          />
        }
        footer={
          currentWorkspace ? (
            <AppFooter
              activeStudio={activeStudio}
              isSimpleWorkspace={currentWorkspace.kind === 'simple'}
              onConvertToDevProject={() => setConvertWorkspaceOpen(true)}
              githubEnabled={remoteKind === 'github'}
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
              onOpenBudget={openBudget}
              onOpenImpact={openImpact}
              onOpenGithub={() => {
                closeAllStudios();
                setGithubStudioSession(currentSession?.id ?? null);
                setGithubStudioIssueId(null);
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
        leftHidden={sessionSidebar.leftHidden}
        leftSidebar={hasWorkspaces ? <WorkspacesSidebar /> : undefined}
        leftOverlay={
          hasWorkspaces && hasActiveSession && sessionSidebar.isCollapsed ? (
            <SidebarPeekOverlay
              isPeeking={sessionSidebar.isPeeking}
              onEdgeEnter={() => sessionSidebar.requestPeek({ source: 'edge' })}
              onEdgeLeave={() => {
                sessionSidebar.cancelPeek();
                sessionSidebar.scheduleClose();
              }}
              onPanelEnter={sessionSidebar.cancelClose}
              onPanelLeave={sessionSidebar.scheduleClose}
              onHold={sessionSidebar.holdPeek}
              onRelease={sessionSidebar.releasePeek}
            >
              <WorkspacesSidebar onNavigate={sessionSidebar.closePeek} />
            </SidebarPeekOverlay>
          ) : undefined
        }
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
      {currentWorkspace ? (
        <ConvertWorkspaceDialog
          open={convertWorkspaceOpen}
          workspace={currentWorkspace}
          onClose={() => setConvertWorkspaceOpen(false)}
        />
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
          workspaceId={currentWorkspace.id}
          rootPath={currentWorkspace.rootPath}
          workspaceName={currentWorkspace.name}
          initialSessionId={githubStudioSession}
          initialPrNumber={githubStudioPrNumber}
          initialThreadId={githubStudioThreadId}
          initialIssueExternalId={githubStudioIssueId}
          onClose={() => setGithubStudioOpen(false)}
        />
      ) : null}
      {providerStudioOpen && currentWorkspace ? (
        <ProviderStudio
          workspaceId={currentWorkspace.id}
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
      {impactStudioOpen && currentWorkspace ? (
        <ImpactStudio
          workspaceId={currentWorkspace.id}
          workspaceName={currentWorkspace.name}
          onClose={() => setImpactStudioOpen(false)}
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
          jumpToFile={commitDiff.file}
        />
      ) : null}
      {currentSession && deleteOpen ? (
        <div className="fixed bottom-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)] rounded-lg bg-background shadow-lg">
          <DeleteSessionConfirm session={currentSession} onClose={() => setDeleteOpen(false)} />
        </div>
      ) : null}
      {currentSession && archiveOpen ? (
        <div className="fixed bottom-4 right-4 z-50 w-96 max-w-[calc(100vw-2rem)] rounded-lg bg-background shadow-lg">
          <ArchiveSessionConfirm session={currentSession} onClose={() => setArchiveOpen(false)} />
        </div>
      ) : null}

      {companionOpen ? <CompanionStudio onClose={() => setCompanionOpen(false)} /> : null}

      <OnboardingWizard />
    </ToastProvider>
  );
};
