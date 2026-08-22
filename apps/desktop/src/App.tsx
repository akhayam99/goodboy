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
import { ReportIssueStudio } from './features/settings/components/ReportIssueStudio';
import { WorkspaceSettingsPane } from './features/workspace/components/WorkspaceSettingsPane';
import { ToastProvider } from './app/components/Toast';
import { NotificationToastBridge } from './features/notifications/components/NotificationToastBridge';
import { WorkflowFollowToastBridge } from './features/workflows/components/WorkflowFollowToastBridge';
import { SessionNavSidebar } from './features/session/components/SessionNavSidebar';
import { CollapsedRail } from './features/session/components/SessionNavSidebar/parts/CollapsedRail';
import { SidebarPeekOverlay } from './features/workspace/components/SidebarPeekOverlay';
import { useWindowPresence } from './features/workspace/hooks/useWindowPresence';
import { WorkspaceLinkDialog } from './features/workspace/components/WorkspaceLinkDialog';
import { ConvertWorkspaceDialog } from './features/workspace/components/ConvertWorkspaceDialog';
import { WorkspaceLauncher } from './features/workspace/components/WorkspaceLauncher';
import { isMainWindow } from './features/workspace/window';
import { WorkflowStudio } from './features/workflows/components/WorkflowStudio';
import { QuickCreateSession } from './features/session/components/QuickCreateSession';
import { GitHubStudio } from './features/github/components/GitHubStudio';
import { LinearStudio } from './features/integrations/linear/LinearStudio';
import { SentryStudio } from './features/integrations/sentry/SentryStudio';
import { BitbucketWorkspaceStudio } from './features/integrations/bitbucket/BitbucketWorkspaceStudio';
import { GitlabStudio } from './features/integrations/gitlab/GitlabStudio';
import { JiraStudio } from './features/integrations/jira/JiraStudio';
import { SlackStudio } from './features/integrations/slack/SlackStudio';
import { ProviderStudio } from './features/providers/components/ProviderStudio';
import { BudgetStudio } from './features/budget/components/BudgetStudio';
import type { BudgetScope } from './features/budget/components/BudgetStudio/lib';
import { ImpactStudio } from './features/impact/components/ImpactStudio';
import { ChangelogStudio } from './features/changelog/components/ChangelogStudio';
import { ReleaseToast } from './features/changelog/components/ReleaseToast';
import { NotificationsStudio } from './features/notifications/components/NotificationsStudio';
import { NOTIFICATIONS_STUDIO_EVENT } from './features/notifications/studioEvent';
import { REPORT_ISSUE_STUDIO_EVENT } from './features/settings/reportIssueStudioEvent';
import { DiffViewerDialog } from './features/permissions/components/DiffViewerDialog';
import { ghCommitDiff } from './features/github/github';
import { worktreeDiffCommit } from './features/worktree/worktree';
import { OnboardingCard } from './features/onboarding/OnboardingCard';
import { OnboardingWizard } from './features/onboarding/OnboardingWizard';
import { CompanionStudio } from './features/companion/CompanionStudio';
import { listenBridgeCommands } from './features/companion/commandExecutor';
import { listenProjectMaterializeRequests } from './features/session/projectMaterializeBridge';
import { markStepComplete } from './features/onboarding/onboarding-store';
import { OPEN_COMMAND_PALETTE_EVENT } from './features/onboarding/openCommandPaletteEvent';
import { useShortcut } from './shared/keyboard/useShortcut';
import { useProviderRefreshOnFocus } from './shared/hooks/useProviderRefreshOnFocus';
import { useZoomShortcuts } from './shared/hooks/useZoomShortcuts';
import { useCommitLinkInterceptor } from './shared/hooks/useCommitLinkInterceptor';
import { useUnhandledRejectionNotice } from './shared/hooks/useUnhandledRejectionNotice';
import { isBranchlessSession } from './shared/utils/isBranchlessSession';
import {
  useAppStore,
  useCurrentSession,
  useCurrentWorkspace,
  useSessionById,
  useSessions,
  useWorkspaces,
  type LensKind,
} from './store';
import { useGithubPolling } from './features/github/hooks/useGithubPolling';
import { useUpdaterPolling } from './features/updater/hooks/useUpdaterPolling';
import { useGithubConnection } from './features/integrations/github/useGithubConnection';
import { resolveSessionRepo } from './store/slices/worktrees/resolveSessionRepo';
import { resolveOpenDiffViewerEvent } from './store/slices/session-view/openDiffViewerEvent';
import { useSessionSidebarVisibility } from './features/workspace/hooks/useSessionSidebarVisibility';

const KEEP_ALIVE_CAP = 5;

export const App = () => {
  const hydrate = useAppStore((s) => s.hydrate);
  const retryHydrate = useAppStore((s) => s.retryHydrate);
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
  const githubConnection = useGithubConnection({ workspaceId: currentWorkspace?.id ?? null });
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
  const hasJira = useAppStore((s) =>
    (s.workspaceIntegrations?.[currentWorkspace?.id ?? ('' as WorkspaceId)] ?? []).some(
      (i) => i.provider === 'jira',
    ),
  );
  const hasGitlab = useAppStore((s) =>
    (s.workspaceIntegrations?.[currentWorkspace?.id ?? ('' as WorkspaceId)] ?? []).some(
      (i) => i.provider === 'gitlab',
    ),
  );
  const hasBitbucket = useAppStore((s) =>
    (s.workspaceIntegrations?.[currentWorkspace?.id ?? ('' as WorkspaceId)] ?? []).some(
      (i) => i.provider === 'bitbucket',
    ),
  );
  const hasSlack = useAppStore((s) =>
    (s.workspaceIntegrations?.[currentWorkspace?.id ?? ('' as WorkspaceId)] ?? []).some(
      (i) => i.provider === 'slack',
    ),
  );
  const [companionOpen, setCompanionOpen] = useState(false);
  const [appSettingsOpen, setAppSettingsOpen] = useState(false);
  const [appSettingsFocus, setAppSettingsFocus] = useState<string | undefined>(undefined);
  const [guideStudioOpen, setGuideStudioOpen] = useState(false);
  const [reportIssueStudioOpen, setReportIssueStudioOpen] = useState(false);
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false);
  const [workspaceSettingsFocus, setWorkspaceSettingsFocus] = useState<string | undefined>(
    undefined,
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSessionId, setDeleteSessionId] = useState<SessionId | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveSessionId, setArchiveSessionId] = useState<SessionId | null>(null);
  const deleteTargetSession = useSessionById(deleteSessionId);
  const archiveTargetSession = useSessionById(archiveSessionId);
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
  const [jiraStudioOpen, setJiraStudioOpen] = useState(false);
  const [jiraStudioFocus, setJiraStudioFocus] = useState<string | null>(null);
  const [bitbucketStudioOpen, setBitbucketStudioOpen] = useState(false);
  const [slackStudioOpen, setSlackStudioOpen] = useState(false);
  const [slackStudioFocus, setSlackStudioFocus] = useState<string | null>(null);
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
  const [changelogStudioOpen, setChangelogStudioOpen] = useState(false);
  const [notificationsStudioOpen, setNotificationsStudioOpen] = useState(false);
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

  const closeAllStudios = useCallback(() => {
    setWorkflowStudioOpen(false);
    setGithubStudioOpen(false);
    setProviderStudioOpen(false);
    setBudgetStudioOpen(false);
    setImpactStudioOpen(false);
    setChangelogStudioOpen(false);
    setNotificationsStudioOpen(false);
    setLinearStudioOpen(false);
    setSentryStudioOpen(false);
    setGitlabStudioOpen(false);
    setJiraStudioOpen(false);
    setBitbucketStudioOpen(false);
    setSlackStudioOpen(false);
    setAppSettingsOpen(false);
    setGuideStudioOpen(false);
    setReportIssueStudioOpen(false);
    setAddWorkspaceOpen(false);
  }, []);

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
  useUnhandledRejectionNotice();

  useEffect(() => {
    const onOpenSettings = (event: Event) => {
      const detail = (event as CustomEvent<{ section?: string }>).detail;
      closeAllStudios();
      setAppSettingsFocus(detail?.section);
      setAppSettingsOpen(true);
    };
    const onOpenGuide = () => {
      closeAllStudios();
      setGuideStudioOpen(true);
    };
    const onOpenReportIssue = () => {
      closeAllStudios();
      setReportIssueStudioOpen(true);
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
      closeAllStudios();
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
      const resolved = resolveOpenDiffViewerEvent({ detail });
      if (resolved === null) {
        return;
      }
      setNewSessionOpen(false);
      setWorkspaceSettingsOpen(false);
      setWorkspaceSettingsFocus(undefined);
      useAppStore.getState().openDiffLens(resolved.sessionId, resolved.focus);
    };
    const onOpenProviderStudio = (event: Event) => {
      const detail = (
        event as CustomEvent<{ providerId?: ProviderId; action?: ProviderLifecycleAction }>
      ).detail;
      closeAllStudios();
      setProviderStudioFocus(detail?.providerId ?? null);
      setProviderStudioAction(detail?.action ?? null);
      setProviderStudioOpen(true);
    };
    const onOpenBudgetStudio = (event: Event) => {
      const detail = (event as CustomEvent<{ scope?: BudgetScope }>).detail;
      closeAllStudios();
      setBudgetStudioScope(detail?.scope);
      setBudgetStudioOpen(true);
    };
    const onOpenLinearStudio = (event: Event) => {
      const detail = (event as CustomEvent<{ issueExternalId?: string }>).detail;
      closeAllStudios();
      setLinearStudioFocus(detail?.issueExternalId ?? null);
      setLinearStudioOpen(true);
    };
    const onOpenSentryStudio = (event: Event) => {
      const detail = (event as CustomEvent<{ issueExternalId?: string }>).detail;
      closeAllStudios();
      setSentryStudioFocus(detail?.issueExternalId ?? null);
      setSentryStudioOpen(true);
    };
    const onOpenGitlabStudio = (event: Event) => {
      const detail = (event as CustomEvent<{ issueExternalId?: string }>).detail;
      closeAllStudios();
      setGitlabStudioFocus(detail?.issueExternalId ?? null);
      setGitlabStudioOpen(true);
    };
    const onOpenJiraStudio = (event: Event) => {
      const detail = (event as CustomEvent<{ issueExternalId?: string }>).detail;
      closeAllStudios();
      setJiraStudioFocus(detail?.issueExternalId ?? null);
      setJiraStudioOpen(true);
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
    const onOpenNotificationsStudio = () => {
      closeAllStudios();
      setNotificationsStudioOpen(true);
    };
    window.addEventListener(NOTIFICATIONS_STUDIO_EVENT, onOpenNotificationsStudio);
    window.addEventListener('goodboy:open-settings', onOpenSettings);
    window.addEventListener('goodboy:open-guide', onOpenGuide);
    window.addEventListener(REPORT_ISSUE_STUDIO_EVENT, onOpenReportIssue);
    window.addEventListener('goodboy:open-github-studio', onOpenGithubStudio);
    window.addEventListener('goodboy:open-plan-studio', onOpenPlanStudio);
    window.addEventListener('goodboy:open-diff-viewer', onOpenDiffViewer);
    window.addEventListener('goodboy:open-provider-studio', onOpenProviderStudio);
    window.addEventListener('goodboy:open-budget-studio', onOpenBudgetStudio);
    window.addEventListener('goodboy:open-linear-studio', onOpenLinearStudio);
    window.addEventListener('goodboy:open-sentry-studio', onOpenSentryStudio);
    window.addEventListener('goodboy:open-gitlab-studio', onOpenGitlabStudio);
    window.addEventListener('goodboy:open-jira-studio', onOpenJiraStudio);
    window.addEventListener('goodboy:reveal-chat', onRevealChat);
    window.addEventListener('goodboy:add-workspace', onAddWorkspace);
    window.addEventListener('goodboy:open-pair-device', onPairDevice);
    return () => {
      window.removeEventListener(NOTIFICATIONS_STUDIO_EVENT, onOpenNotificationsStudio);
      window.removeEventListener('goodboy:open-settings', onOpenSettings);
      window.removeEventListener('goodboy:open-guide', onOpenGuide);
      window.removeEventListener(REPORT_ISSUE_STUDIO_EVENT, onOpenReportIssue);
      window.removeEventListener('goodboy:open-github-studio', onOpenGithubStudio);
      window.removeEventListener('goodboy:open-plan-studio', onOpenPlanStudio);
      window.removeEventListener('goodboy:open-diff-viewer', onOpenDiffViewer);
      window.removeEventListener('goodboy:open-provider-studio', onOpenProviderStudio);
      window.removeEventListener('goodboy:open-budget-studio', onOpenBudgetStudio);
      window.removeEventListener('goodboy:open-linear-studio', onOpenLinearStudio);
      window.removeEventListener('goodboy:open-sentry-studio', onOpenSentryStudio);
      window.removeEventListener('goodboy:open-gitlab-studio', onOpenGitlabStudio);
      window.removeEventListener('goodboy:open-jira-studio', onOpenJiraStudio);
      window.removeEventListener('goodboy:reveal-chat', onRevealChat);
      window.removeEventListener('goodboy:add-workspace', onAddWorkspace);
      window.removeEventListener('goodboy:open-pair-device', onPairDevice);
    };
  }, [closeAllStudios]);

  useEffect(() => {
    if (!archiveOpen && !deleteOpen) {
      return;
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      setArchiveOpen(false);
      setDeleteOpen(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [archiveOpen, deleteOpen]);

  useEffect(() => {
    const handler = () => {
      closeAllStudios();
      setWorkflowStudioOpen(true);
    };
    window.addEventListener('goodboy:open-workflow-studio', handler);
    return () => window.removeEventListener('goodboy:open-workflow-studio', handler);
  }, [closeAllStudios]);

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
      if (!detail?.sessionId) {
        return;
      }
      setNewSessionOpen(false);
      setWorkspaceSettingsOpen(false);
      setWorkspaceSettingsFocus(undefined);
      setSessionStudio(detail.sessionId, { kind: 'bitbucket' });
    };
    window.addEventListener('goodboy:open-bitbucket-pr', handler);
    return () => window.removeEventListener('goodboy:open-bitbucket-pr', handler);
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
    let off: (() => void) | undefined;
    let cancelled = false;
    void listenProjectMaterializeRequests().then((fn) => {
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
            : changelogStudioOpen
              ? 'changelog'
              : notificationsStudioOpen
                ? 'notifications'
                : linearStudioOpen
                  ? 'linear'
                  : sentryStudioOpen
                    ? 'sentry'
                    : gitlabStudioOpen
                      ? 'gitlab'
                      : jiraStudioOpen
                        ? 'jira'
                        : bitbucketStudioOpen
                          ? 'bitbucket'
                          : slackStudioOpen
                            ? 'slack'
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
  const openChangelog = useCallback(() => {
    closeAllStudios();
    setChangelogStudioOpen(true);
  }, [closeAllStudios]);
  const openDeleteSession = useCallback(() => {
    if (currentSession) {
      setDeleteSessionId(currentSession.id);
      setDeleteOpen(true);
    }
  }, [currentSession]);
  const openArchiveSession = useCallback(() => {
    if (currentSession) {
      setArchiveSessionId(currentSession.id);
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

  useEffect(() => {
    const handler = () => openPalette();
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, handler);
    return () => window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, handler);
  }, [openPalette]);
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
    const id = s.currentSessionId;
    if (!id) {
      return;
    }
    s.setActiveLens(id, kind != null && s.activeLens[id] === kind ? null : kind);
  }, []);

  const isExploreSession = useAppStore((s) => {
    const sessionId = s.currentSessionId;
    if (sessionId == null) {
      return false;
    }
    const session = s.sessions.find((candidate) => candidate.id === sessionId);
    if (session == null) {
      return false;
    }
    return isBranchlessSession({
      branch: s.sessionBranches[sessionId],
    });
  });

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

  useShortcut('settings.open', openSettings);
  useShortcut('settings.shortcuts', openShortcutHelp);
  useShortcut('palette.open', () => openPalette());
  useShortcut('session.new', openNewSession);
  useShortcut('workspace.switcher', () =>
    window.dispatchEvent(new CustomEvent('goodboy:open-workspace-switcher')),
  );
  useShortcut('column.toggle', sessionSidebar.toggle);
  useShortcut('lens.back', () => navigateLens(-1));
  useShortcut('lens.forward', () => navigateLens(1));
  useShortcut('workspace.1', () => selectWorkspaceByIndex(0));
  useShortcut('workspace.2', () => selectWorkspaceByIndex(1));
  useShortcut('workspace.3', () => selectWorkspaceByIndex(2));
  useShortcut('workspace.4', () => selectWorkspaceByIndex(3));
  useShortcut('workspace.5', () => selectWorkspaceByIndex(4));
  useShortcut('workspace.6', () => selectWorkspaceByIndex(5));
  useShortcut('workspace.7', () => selectWorkspaceByIndex(6));
  useShortcut('workspace.8', () => selectWorkspaceByIndex(7));
  useShortcut('workspace.9', () => selectWorkspaceByIndex(8));

  useShortcut('session.delete', openDeleteSession);
  useShortcut('session.archive', openArchiveSession);
  useShortcut('session.model', openModelPicker);
  useShortcut('session.permissions', openPermissionPicker);
  useShortcut('session.prev', () => navigateSession(-1));
  useShortcut('session.next', () => navigateSession(1));
  useShortcut('session.board', () => void setCurrentSession(null));

  useShortcut('lens.overview', () => goToLens(null));
  useShortcut('lens.context', () => goToLens('context'));
  useShortcut('lens.goal', () => goToLens('goal'));
  useShortcut('lens.decisions', () => goToLens('decisions'));
  useShortcut('lens.summary', () => goToLens('last_output_summary'));
  useShortcut('lens.workflows', () => goToLens('workflows'));
  useShortcut('lens.agents', () => goToLens('agents'));
  useShortcut('lens.resolve', () => goToLens('resolve'));
  useShortcut('lens.review', () => goToLens('review'));
  useShortcut('lens.questions', () => goToLens('questions'));
  useShortcut('lens.files', () => goToLens('files'), !isExploreSession);
  useShortcut('lens.explore', () => goToLens('explore'), isExploreSession);
  useShortcut('lens.plans', () => goToLens('plans'));
  useShortcut('lens.scripts', () => goToLens('scripts'));
  useShortcut('lens.terminal', () => goToLens('terminal'));
  useShortcut('lens.pr', () => goToLens('pr'));
  useShortcut('lens.linear', () => goToLens('linear'));
  useShortcut('lens.sentry', () => goToLens('sentry'));
  useShortcut('lens.gitlab_issues', () => goToLens('gitlab_issues'));
  useShortcut('lens.jira_issues', () => goToLens('jira_issues'));
  useShortcut('lens.slack_threads', () => goToLens('slack_threads'));

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
        onRetry={retryHydrate}
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
      <WorkflowFollowToastBridge />
      <ReleaseToast onOpenChangelog={openChangelog} />
      <AppShell
        topBar={<AppTopBar onOpenBudget={openBudget} showWorkspaceIdentity={!hasActiveSession} />}
        footer={
          currentWorkspace ? (
            <AppFooter
              activeStudio={activeStudio}
              isSimpleWorkspace={false}
              onConvertToDevProject={() => setConvertWorkspaceOpen(true)}
              githubEnabled={githubConnection.isAuthenticated}
              linearEnabled={hasLinear}
              jiraEnabled={hasJira}
              sentryEnabled={hasSentry}
              gitlabEnabled={hasGitlab}
              bitbucketEnabled={hasBitbucket}
              slackEnabled={hasSlack}
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
              onOpenSettings={openSettings}
              onOpenBudget={openBudget}
              onOpenImpact={openImpact}
              onOpenChangelog={openChangelog}
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
              onOpenJira={() => {
                closeAllStudios();
                setJiraStudioFocus(null);
                setJiraStudioOpen(true);
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
              onOpenBitbucket={() => {
                closeAllStudios();
                setBitbucketStudioOpen(true);
              }}
              onOpenSlack={() => {
                closeAllStudios();
                setSlackStudioFocus(null);
                setSlackStudioOpen(true);
              }}
            />
          ) : undefined
        }
        leftHidden={!hasActiveSession}
        leftSidebarCollapsed={sessionSidebar.isCollapsed}
        leftSidebar={
          currentSession ? (
            sessionSidebar.isCollapsed ? (
              <CollapsedRail onExpand={sessionSidebar.pin} />
            ) : (
              <SessionNavSidebar session={currentSession} onCollapse={sessionSidebar.toggle} />
            )
          ) : undefined
        }
        leftOverlay={
          currentSession && sessionSidebar.isCollapsed ? (
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
              <SessionNavSidebar
                session={currentSession}
                onCollapse={sessionSidebar.pin}
                collapseAction="pin"
                onNavigate={sessionSidebar.closePeek}
              />
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
            <QuickCreateSession
              workspaceId={currentWorkspace.id}
              onClose={() => setNewSessionOpen(false)}
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
      {reportIssueStudioOpen ? (
        <ReportIssueStudio onClose={() => setReportIssueStudioOpen(false)} />
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
          onOpenProviders={() => {
            closeAllStudios();
            setProviderStudioFocus(null);
            setProviderStudioAction(null);
            setProviderStudioOpen(true);
            setPaletteOpen(false);
          }}
          onOpenShortcutHelp={() => {
            openShortcutHelp();
            setPaletteOpen(false);
          }}
        />
      ) : null}
      {addWorkspaceOpen ? (
        <WorkspaceLinkDialog
          open
          onClose={() => setAddWorkspaceOpen(false)}
          onOfferRepo={() => setConvertWorkspaceOpen(true)}
        />
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
          rootPath={currentWorkspace.sessionsRoot ?? ''}
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
      {changelogStudioOpen && currentWorkspace ? (
        <ChangelogStudio
          workspaceName={currentWorkspace.name}
          onClose={() => setChangelogStudioOpen(false)}
        />
      ) : null}
      {notificationsStudioOpen && currentWorkspace ? (
        <NotificationsStudio
          workspaceName={currentWorkspace.name}
          onClose={() => setNotificationsStudioOpen(false)}
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
      {jiraStudioOpen && currentWorkspace ? (
        <JiraStudio
          workspaceId={currentWorkspace.id}
          workspaceName={currentWorkspace.name}
          initialIssueId={jiraStudioFocus}
          onClose={() => setJiraStudioOpen(false)}
        />
      ) : null}
      {bitbucketStudioOpen && currentWorkspace ? (
        <BitbucketWorkspaceStudio
          workspaceId={currentWorkspace.id}
          workspaceName={currentWorkspace.name}
          onClose={() => setBitbucketStudioOpen(false)}
        />
      ) : null}
      {slackStudioOpen && currentWorkspace ? (
        <SlackStudio
          workspaceId={currentWorkspace.id}
          workspaceName={currentWorkspace.name}
          initialThreadTs={slackStudioFocus}
          onClose={() => setSlackStudioOpen(false)}
        />
      ) : null}
      {commitDiff ? (
        <DiffViewerDialog
          open
          onClose={() => setCommitDiff(null)}
          title={`Commit ${commitDiff.sha.slice(0, 7)}`}
          loader={commitDiffLoader}
        />
      ) : null}
      {deleteTargetSession && deleteOpen ? (
        <div className="fixed bottom-4 right-4 z-popover w-96 max-w-[calc(100vw-2rem)] rounded-lg bg-background shadow-lg">
          <DeleteSessionConfirm
            session={deleteTargetSession}
            onClose={() => {
              setDeleteOpen(false);
              setDeleteSessionId(null);
            }}
          />
        </div>
      ) : null}
      {archiveTargetSession && archiveOpen ? (
        <div className="fixed bottom-4 right-4 z-popover w-96 max-w-[calc(100vw-2rem)] rounded-lg bg-background shadow-lg">
          <ArchiveSessionConfirm
            session={archiveTargetSession}
            onClose={() => {
              setArchiveOpen(false);
              setArchiveSessionId(null);
            }}
          />
        </div>
      ) : null}

      {companionOpen ? <CompanionStudio onClose={() => setCompanionOpen(false)} /> : null}

      <OnboardingWizard />
    </ToastProvider>
  );
};
