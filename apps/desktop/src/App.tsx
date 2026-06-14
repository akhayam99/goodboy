import { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { AppShell } from '@goodboy/ui';
import type { PlanId, ProviderId, ProviderLifecycleAction, SessionId } from '@goodboy/types';
import { CommandPalette } from './features/session/components/CommandPalette';
import { BootSplash } from './app/components/BootSplash';
import { KeepAliveChatPanel, KeepAliveContextPanel } from './app/components/KeepAlivePanels';
import { EmptyState } from './app/components/AppEmptyState';
import { DeleteSessionDialog } from './features/session/components/DeleteSessionDialog';
import { ArchiveSessionDialog } from './features/session/components/ArchiveSessionDialog';
import { SettingsStudio } from './features/settings/components/SettingsStudio';
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
import { WorkflowBuilderView } from './features/session/components/WorkflowBuilderView';
import { NewSessionView } from './features/session/components/NewSessionView';
import { GitHubStudio } from './features/github/components/GitHubStudio';
import { GitHubSessionPane } from './features/github/components/GitHubSessionPane';
import { MrSessionPane } from './features/integrations/gitlab/MrSessionPane';
import { PlanStudio } from './features/plans/components/PlanStudio';
import { LinearStudio } from './features/integrations/linear/LinearStudio';
import { SentryStudio } from './features/integrations/sentry/SentryStudio';
import { GitlabStudio } from './features/integrations/gitlab/GitlabStudio';
import { ProviderStudio } from './features/providers/components/ProviderStudio';
import { BudgetStudio } from './features/budget/components/BudgetStudio';
import type { BudgetScope } from './features/budget/components/BudgetStudio/lib';
import {
  DiffViewerDialog,
  DiffViewerPane,
} from './features/permissions/components/DiffViewerDialog';
import { ghCommitDiff } from './features/github/github';
import { worktreeDiffCommit } from './features/worktree/worktree';
import { OnboardingCard } from './features/onboarding/OnboardingCard';
import { OnboardingWizard } from './features/onboarding/OnboardingWizard';
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
  useSessionSlots,
  useWorkspaces,
} from './store';
import { refreshPricingTable } from './features/providers/provider-pricing';
import { useGithubPolling } from './features/github/hooks/useGithubPolling';
import { useUpdaterPolling } from './features/updater/hooks/useUpdaterPolling';
import { STORAGE_PREFIXES } from './shared/lib/storage-keys';

const CONTEXT_PANEL_KEY = (id: SessionId): string => `${STORAGE_PREFIXES.contextPanelOpen}${id}`;

const KEEP_ALIVE_CAP = 5;

function readPersistedContextOpen(id: SessionId, fallback: boolean): boolean {
  try {
    const raw = localStorage.getItem(CONTEXT_PANEL_KEY(id));
    if (raw === null) {
      return fallback;
    }
    return raw === '1';
  } catch {
    return fallback;
  }
}

function writePersistedContextOpen(id: SessionId, open: boolean): void {
  try {
    localStorage.setItem(CONTEXT_PANEL_KEY(id), open ? '1' : '0');
  } catch {
    // localStorage unavailable, ignore
  }
}

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
  const slots = useSessionSlots(currentSession?.id ?? null);
  const [appSettingsOpen, setAppSettingsOpen] = useState(false);
  const [appSettingsFocus, setAppSettingsFocus] = useState<string | undefined>(undefined);
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
  const [planStudioSession, setPlanStudioSession] = useState<SessionId | null>(null);
  const [planStudioPlanId, setPlanStudioPlanId] = useState<PlanId | null>(null);
  const [diffViewerSession, setDiffViewerSession] = useState<SessionId | null>(null);
  const [diffViewerWorkingDir, setDiffViewerWorkingDir] = useState<string | null>(null);
  const [githubSessionPane, setGithubSessionPane] = useState<{
    sessionId: SessionId;
    prNumber: number | null;
    threadId: string | null;
  } | null>(null);
  const [gitlabMrPane, setGitlabMrPane] = useState<{ sessionId: SessionId } | null>(null);
  const [budgetStudioOpen, setBudgetStudioOpen] = useState(false);
  const [budgetStudioScope, setBudgetStudioScope] = useState<BudgetScope | undefined>(undefined);
  const [workflowBuilderSessionId, setWorkflowBuilderSessionId] = useState<SessionId | null>(null);
  const [newSessionOpen, setNewSessionOpen] = useState(false);
  const { commitDiff, setCommitDiff } = useCommitLinkInterceptor();
  const [leftCollapsed, setLeftCollapsed] = useState(
    () =>
      typeof localStorage !== 'undefined' &&
      localStorage.getItem('goodboy:left-sidebar-collapsed') === '1',
  );
  const [contextOpen, setContextOpen] = useState<boolean>(false);
  const [contextHydratedFor, setContextHydratedFor] = useState<SessionId | null>(null);
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

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ section?: string }>).detail;
      setAppSettingsFocus(detail?.section);
      setAppSettingsOpen(true);
    };
    window.addEventListener('goodboy:open-settings', handler);
    return () => window.removeEventListener('goodboy:open-settings', handler);
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
      setPlanStudioSession(null);
      setDiffViewerSession(null);
      setGithubSessionPane(null);
      setGitlabMrPane(null);
      setWorkspaceSettingsOpen(true);
    };
    window.addEventListener('goodboy:open-workspace-settings', handler);
    return () => window.removeEventListener('goodboy:open-workspace-settings', handler);
  }, [workspaceSettingsOpen]);

  useEffect(() => {
    const handler = () => {
      if (sessionSettingsOpen) {
        setSessionSettingsOpen(false);
        return;
      }
      setWorkspaceSettingsOpen(false);
      setWorkspaceSettingsFocus(undefined);
      setWorkflowBuilderSessionId(null);
      setNewSessionOpen(false);
      setPlanStudioSession(null);
      setDiffViewerSession(null);
      setGithubSessionPane(null);
      setGitlabMrPane(null);
      setSessionSettingsOpen(true);
    };
    window.addEventListener('goodboy:open-session-settings', handler);
    return () => window.removeEventListener('goodboy:open-session-settings', handler);
  }, [sessionSettingsOpen]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (
        event as CustomEvent<{ sessionId?: SessionId; prNumber?: number; threadId?: string }>
      ).detail;
      setGithubStudioSession(detail?.sessionId ?? null);
      setGithubStudioPrNumber(detail?.prNumber ?? null);
      setGithubStudioThreadId(detail?.threadId ?? null);
      setGithubStudioOpen(true);
    };
    window.addEventListener('goodboy:open-github-studio', handler);
    return () => window.removeEventListener('goodboy:open-github-studio', handler);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          sessionId?: SessionId;
          planId?: PlanId;
        }>
      ).detail;
      setNewSessionOpen(false);
      setWorkspaceSettingsOpen(false);
      setWorkspaceSettingsFocus(undefined);
      setSessionSettingsOpen(false);
      setWorkflowBuilderSessionId(null);
      setDiffViewerSession(null);
      setGithubSessionPane(null);
      setGitlabMrPane(null);
      setPlanStudioSession(detail?.sessionId ?? null);
      setPlanStudioPlanId(detail?.planId ?? null);
    };
    window.addEventListener('goodboy:open-plan-studio', handler);
    return () => window.removeEventListener('goodboy:open-plan-studio', handler);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId?: SessionId; workingDir?: string }>).detail;
      if (!detail?.sessionId) {
        return;
      }
      setNewSessionOpen(false);
      setWorkspaceSettingsOpen(false);
      setWorkspaceSettingsFocus(undefined);
      setSessionSettingsOpen(false);
      setWorkflowBuilderSessionId(null);
      setPlanStudioSession(null);
      setGithubSessionPane(null);
      setGitlabMrPane(null);
      setDiffViewerSession(detail.sessionId);
      setDiffViewerWorkingDir(detail.workingDir ?? null);
    };
    window.addEventListener('goodboy:open-diff-viewer', handler);
    return () => window.removeEventListener('goodboy:open-diff-viewer', handler);
  }, []);

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
      setWorkflowBuilderSessionId(null);
      setPlanStudioSession(null);
      setDiffViewerSession(null);
      setGitlabMrPane(null);
      setGithubSessionPane({
        sessionId: detail.sessionId,
        prNumber: detail.prNumber ?? null,
        threadId: detail.threadId ?? null,
      });
    };
    window.addEventListener('goodboy:open-github-session', handler);
    return () => window.removeEventListener('goodboy:open-github-session', handler);
  }, []);

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
      setWorkflowBuilderSessionId(null);
      setPlanStudioSession(null);
      setDiffViewerSession(null);
      setGithubSessionPane(null);
      setGitlabMrPane({ sessionId: detail.sessionId });
    };
    window.addEventListener('goodboy:open-gitlab-mr', handler);
    return () => window.removeEventListener('goodboy:open-gitlab-mr', handler);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (
        event as CustomEvent<{ providerId?: ProviderId; action?: ProviderLifecycleAction }>
      ).detail;
      setProviderStudioFocus(detail?.providerId ?? null);
      setProviderStudioAction(detail?.action ?? null);
      setProviderStudioOpen(true);
    };
    window.addEventListener('goodboy:open-provider-studio', handler);
    return () => window.removeEventListener('goodboy:open-provider-studio', handler);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ scope?: BudgetScope }>).detail;
      setBudgetStudioScope(detail?.scope);
      setBudgetStudioOpen(true);
    };
    window.addEventListener('goodboy:open-budget-studio', handler);
    return () => window.removeEventListener('goodboy:open-budget-studio', handler);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ issueExternalId?: string }>).detail;
      setLinearStudioFocus(detail?.issueExternalId ?? null);
      setLinearStudioOpen(true);
    };
    window.addEventListener('goodboy:open-linear-studio', handler);
    return () => window.removeEventListener('goodboy:open-linear-studio', handler);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ issueExternalId?: string }>).detail;
      setSentryStudioFocus(detail?.issueExternalId ?? null);
      setSentryStudioOpen(true);
    };
    window.addEventListener('goodboy:open-sentry-studio', handler);
    return () => window.removeEventListener('goodboy:open-sentry-studio', handler);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ issueExternalId?: string }>).detail;
      setGitlabStudioFocus(detail?.issueExternalId ?? null);
      setGitlabStudioOpen(true);
    };
    window.addEventListener('goodboy:open-gitlab-studio', handler);
    return () => window.removeEventListener('goodboy:open-gitlab-studio', handler);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId?: SessionId }>).detail;
      if (detail?.sessionId) {
        setWorkspaceSettingsOpen(false);
        setWorkspaceSettingsFocus(undefined);
        setSessionSettingsOpen(false);
        setNewSessionOpen(false);
        setPlanStudioSession(null);
        setDiffViewerSession(null);
        setGithubSessionPane(null);
        setGitlabMrPane(null);
        setWorkflowBuilderSessionId(detail.sessionId);
      }
    };
    window.addEventListener('goodboy:open-workflow-builder', handler);
    return () => window.removeEventListener('goodboy:open-workflow-builder', handler);
  }, []);

  useEffect(() => {
    const handler = () => {
      if (!currentWorkspace) {
        return;
      }
      setWorkspaceSettingsOpen(false);
      setWorkspaceSettingsFocus(undefined);
      setSessionSettingsOpen(false);
      setWorkflowBuilderSessionId(null);
      setPlanStudioSession(null);
      setDiffViewerSession(null);
      setGithubSessionPane(null);
      setGitlabMrPane(null);
      setNewSessionOpen(true);
    };
    window.addEventListener('goodboy:new-session', handler);
    return () => window.removeEventListener('goodboy:new-session', handler);
  }, [currentWorkspace]);

  useEffect(() => {
    const handler = () => setAddWorkspaceOpen(true);
    window.addEventListener('goodboy:add-workspace', handler);
    return () => window.removeEventListener('goodboy:add-workspace', handler);
  }, []);

  useEffect(() => {
    const handler = () => setSwitcherOpen(true);
    window.addEventListener('goodboy:open-workspace-switcher', handler);
    return () => window.removeEventListener('goodboy:open-workspace-switcher', handler);
  }, []);

  useEffect(() => {
    if (!currentSession) {
      setContextOpen(false);
      setContextHydratedFor(null);
      return;
    }
    if (contextHydratedFor === currentSession.id) {
      return;
    }
    const enabledSlots = slots.filter((s) => s.enabled && s.value.length > 0).length;
    const fallback = enabledSlots > 0;
    setContextOpen(readPersistedContextOpen(currentSession.id, fallback));
    setContextHydratedFor(currentSession.id);
  }, [currentSession, slots, contextHydratedFor]);

  const onToggleContext = () => {
    if (!currentSession) {
      return;
    }
    setContextOpen((open) => {
      const next = !open;
      writePersistedContextOpen(currentSession.id, next);
      return next;
    });
  };

  useEffect(() => {
    setKeepAliveIds([]);
  }, [currentWorkspace?.id]);

  useEffect(() => {
    if (workflowBuilderSessionId && currentSession?.id !== workflowBuilderSessionId) {
      setWorkflowBuilderSessionId(null);
    }
  }, [workflowBuilderSessionId, currentSession?.id]);

  useEffect(() => {
    if (githubSessionPane && currentSession?.id !== githubSessionPane.sessionId) {
      setGithubSessionPane(null);
    }
  }, [githubSessionPane, currentSession?.id]);

  useEffect(() => {
    if (gitlabMrPane && currentSession?.id !== gitlabMrPane.sessionId) {
      setGitlabMrPane(null);
    }
  }, [gitlabMrPane, currentSession?.id]);

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

  const openSettings = useCallback(() => {
    setPlanStudioSession(null);
    setDiffViewerSession(null);
    setGithubSessionPane(null);
    setGitlabMrPane(null);
    setAppSettingsFocus(undefined);
    setAppSettingsOpen(true);
  }, []);
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
  const toggleLeftSidebar = useCallback(() => {
    setLeftCollapsed((v) => {
      const next = !v;
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('goodboy:left-sidebar-collapsed', next ? '1' : '0');
      }
      return next;
    });
  }, []);

  const openWorkspace = useAppStore((s) => s.openWorkspace);
  const setCurrentSession = useAppStore((s) => s.setCurrentSession);
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
  useKeyboardShortcut('cmd+b', toggleLeftSidebar);
  useKeyboardShortcut('cmd+n', openNewSession, { ignoreInInputs: false });
  useKeyboardShortcut('cmd+[', () => navigateSession(-1), { ignoreInInputs: false });
  useKeyboardShortcut('cmd+]', () => navigateSession(1), { ignoreInInputs: false });
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

  if (hasWorkspaces && !currentWorkspace && isMainWindow()) {
    return (
      <ToastProvider>
        <NotificationToastBridge />
        <WorkspaceLauncher />
        {addWorkspaceOpen ? (
          <WorkspaceLinkDialog open onClose={() => setAddWorkspaceOpen(false)} />
        ) : null}
        {switcherOpen ? <WorkspaceSwitcher onClose={() => setSwitcherOpen(false)} /> : null}
      </ToastProvider>
    );
  }

  const contextCollapsed = !contextOpen;
  const rightSidebarCollapsed = !currentSession || contextCollapsed;

  return (
    <ToastProvider>
      <NotificationToastBridge />
      <AppShell
        leftSidebarCollapsed={leftCollapsed}
        leftSidebar={
          hasWorkspaces ? (
            <WorkspacesSidebar
              onOpenSettings={openSettings}
              onOpenPalette={openPalette}
              onOpenWorkflows={() => setWorkflowStudioOpen(true)}
              onOpenLinear={() => {
                setLinearStudioFocus(null);
                setLinearStudioOpen(true);
              }}
              onOpenSentry={() => {
                setSentryStudioFocus(null);
                setSentryStudioOpen(true);
              }}
              onOpenGitlab={() => {
                setGitlabStudioFocus(null);
                setGitlabStudioOpen(true);
              }}
              onOpenProviders={() => {
                setProviderStudioFocus(null);
                setProviderStudioAction(null);
                setProviderStudioOpen(true);
              }}
              onOpenGithub={() => {
                setGithubStudioSession(currentSession?.id ?? null);
                setGithubStudioOpen(true);
              }}
              onOpenBudget={() => {
                setBudgetStudioScope({ kind: 'overview' });
                setBudgetStudioOpen(true);
              }}
              collapsed={leftCollapsed}
              onToggleCollapse={toggleLeftSidebar}
            />
          ) : undefined
        }
        main={
          <div className="relative h-full w-full">
            {error ? (
              <p className="p-6 text-sm text-danger">init error: {error}</p>
            ) : currentSession ? (
              <div className="relative h-full w-full">
                {deferredRenderedIds.map((id) => (
                  <KeepAliveChatPanel key={id} sessionId={id} isActive={id === deferredActiveId} />
                ))}
              </div>
            ) : (
              <EmptyState
                hasWorkspace={Boolean(currentWorkspace)}
                onAddWorkspace={() => setAddWorkspaceOpen(true)}
              />
            )}

            <OnboardingCard />
          </div>
        }
        rightSidebar={
          currentSession ? (
            <div className="relative h-full w-full">
              {deferredRenderedIds.map((id) => (
                <KeepAliveContextPanel
                  key={id}
                  sessionId={id}
                  isActive={id === deferredActiveId}
                  collapsed={contextCollapsed}
                  onCollapse={onToggleContext}
                  onExpand={onToggleContext}
                />
              ))}
            </div>
          ) : null
        }
        rightSidebarCollapsed={rightSidebarCollapsed}
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
          ) : currentSession && workflowBuilderSessionId === currentSession.id ? (
            <WorkflowBuilderView
              session={currentSession}
              onClose={() => setWorkflowBuilderSessionId(null)}
            />
          ) : planStudioSession && currentWorkspace ? (
            <PlanStudio
              sessionId={planStudioSession}
              workspaceName={currentWorkspace.name}
              initialPlanId={planStudioPlanId ?? undefined}
              onClose={() => {
                setPlanStudioSession(null);
                setPlanStudioPlanId(null);
              }}
            />
          ) : diffViewerSession && currentWorkspace ? (
            <DiffViewerPane
              sessionId={diffViewerSession}
              workspaceName={currentWorkspace.name}
              workingDir={diffViewerWorkingDir ?? undefined}
              worktreePath={diffViewerWorkingDir ?? undefined}
              onClose={() => {
                setDiffViewerSession(null);
                setDiffViewerWorkingDir(null);
              }}
            />
          ) : githubSessionPane && currentWorkspace ? (
            <GitHubSessionPane
              sessionId={githubSessionPane.sessionId}
              workspaceName={currentWorkspace.name}
              initialPrNumber={githubSessionPane.prNumber}
              initialThreadId={githubSessionPane.threadId}
              onClose={() => setGithubSessionPane(null)}
            />
          ) : gitlabMrPane && currentWorkspace ? (
            <MrSessionPane
              sessionId={gitlabMrPane.sessionId}
              workspaceName={currentWorkspace.name}
              onClose={() => setGitlabMrPane(null)}
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

      <OnboardingWizard />
    </ToastProvider>
  );
};
