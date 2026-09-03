import { createElement, useCallback, useEffect, useState, type ReactNode } from 'react';
import {
  PROVIDER_IDS,
  type PlanId,
  type ProviderId,
  type ProviderLifecycleAction,
  type Session,
  type SessionId,
  type Workspace,
  type WorkspaceId,
} from '@goodboy/types';
import { AppOverlayRouter } from '../../components/AppOverlayRouter';
import { WorkspaceSettingsPane } from '../../../features/workspace/components/WorkspaceSettingsPane';
import type { BudgetScope } from '../../../features/budget/components/BudgetStudio/lib';
import {
  INBOX_KINDS,
  INBOX_PROVIDERS,
  type InboxKind,
  type InboxProvider,
} from '../../../features/inbox/types';
import { NOTIFICATIONS_STUDIO_EVENT } from '../../../features/notifications/studioEvent';
import { REPORT_ISSUE_STUDIO_EVENT } from '../../../features/settings/reportIssueStudioEvent';
import { ghCommitDiff } from '../../../features/github/github';
import { worktreeDiffCommit } from '../../../features/worktree/worktree';
import { markStepComplete } from '../../../features/onboarding/onboarding-store';
import { OPEN_COMMAND_PALETTE_EVENT } from '../../../features/onboarding/openCommandPaletteEvent';
import { useCommitLinkInterceptor } from '../../../shared/hooks/useCommitLinkInterceptor';
import { useAppStore, useSessionById } from '../../../store';
import { resolveSessionRepo } from '../../../store/slices/worktrees/resolveSessionRepo';
import { resolveOpenDiffViewerEvent } from '../../../store/slices/session-view/openDiffViewerEvent';

type Params = {
  readonly currentSession: Session | null;
  readonly currentWorkspace: Workspace | null;
  readonly workspaceProjectRoot: string | null;
  readonly isSessionSidebarCollapsed: boolean;
  readonly isWorkspaceLauncherBranch: boolean;
  readonly pinSessionSidebar: () => void;
};

type EventValueParams = {
  readonly event: Event;
  readonly key: string;
};

type OpenIssueStudioParams = {
  readonly event: Event;
  readonly setFocus: (value: string | null) => void;
  readonly setOpen: (value: boolean) => void;
};

const eventValue = ({ event, key }: EventValueParams): unknown => {
  if (!(event instanceof CustomEvent)) {
    return undefined;
  }
  const detail: unknown = event.detail;
  if (typeof detail !== 'object' || detail === null) {
    return undefined;
  }
  return Reflect.get(detail, key);
};

const isSessionId = (value: unknown): value is SessionId => typeof value === 'string';

const isPlanId = (value: unknown): value is PlanId => typeof value === 'string';

const isProviderId = (value: unknown): value is ProviderId =>
  typeof value === 'string' && PROVIDER_IDS.some((providerId) => providerId === value);

const isProviderLifecycleAction = (value: unknown): value is ProviderLifecycleAction =>
  value === 'install' || value === 'login' || value === 'logout';

const isWorkspaceId = (value: unknown): value is WorkspaceId => typeof value === 'string';

const isInboxProvider = (value: unknown): value is InboxProvider =>
  typeof value === 'string' && INBOX_PROVIDERS.some((provider) => provider === value);

const isInboxKind = (value: unknown): value is InboxKind =>
  typeof value === 'string' && INBOX_KINDS.some((kind) => kind === value);

type InboxStudioFocus = {
  readonly provider: InboxProvider | null;
  readonly kind: InboxKind | null;
  readonly recordKey: string | null;
};

const isBudgetScope = (value: unknown): value is BudgetScope => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const kind: unknown = Reflect.get(value, 'kind');
  if (kind === 'overview') {
    return true;
  }
  if (kind === 'provider') {
    return typeof Reflect.get(value, 'provider') === 'string';
  }
  if (kind === 'session') {
    return isSessionId(Reflect.get(value, 'sessionId'));
  }
  return false;
};

export const useAppOverlays = ({
  currentSession,
  currentWorkspace,
  workspaceProjectRoot,
  isSessionSidebarCollapsed,
  isWorkspaceLauncherBranch,
  pinSessionSidebar,
}: Params) => {
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
  const [inboxStudioOpen, setInboxStudioOpen] = useState(false);
  const [inboxStudioFocus, setInboxStudioFocus] = useState<InboxStudioFocus | null>(null);
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
  const [githubStudioTab, setGithubStudioTab] = useState<'pull-requests' | 'issues' | null>(null);
  const [budgetStudioOpen, setBudgetStudioOpen] = useState(false);
  const [budgetStudioScope, setBudgetStudioScope] = useState<BudgetScope | undefined>(undefined);
  const [impactStudioOpen, setImpactStudioOpen] = useState(false);
  const [changelogStudioOpen, setChangelogStudioOpen] = useState(false);
  const [notificationsStudioOpen, setNotificationsStudioOpen] = useState(false);
  const setSessionStudio = useAppStore((state) => state.setSessionStudio);
  const { commitDiff, setCommitDiff } = useCommitLinkInterceptor();
  const currentSessionId = useAppStore((state) => state.currentSessionId);
  const currentSessionWorktree = useAppStore((state) =>
    currentSessionId === null
      ? null
      : (resolveSessionRepo({ state, sessionId: currentSessionId })?.worktreePath ?? null),
  );

  const clearSessionStudio = useCallback(() => {
    const sessionId = useAppStore.getState().currentSessionId;
    if (sessionId === null) {
      return;
    }
    useAppStore.getState().setSessionStudio(sessionId, null);
  }, []);

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
    setInboxStudioOpen(false);
    setAppSettingsOpen(false);
    setGuideStudioOpen(false);
    setReportIssueStudioOpen(false);
    setAddWorkspaceOpen(false);
  }, []);

  const openAddWorkspace = useCallback(() => {
    closeAllStudios();
    setAddWorkspaceOpen(true);
  }, [closeAllStudios]);

  const openSettings = useCallback(() => {
    closeAllStudios();
    clearSessionStudio();
    setAppSettingsFocus(undefined);
    setAppSettingsOpen(true);
  }, [clearSessionStudio, closeAllStudios]);

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

  const openWorkflows = useCallback(() => {
    closeAllStudios();
    setWorkflowStudioOpen(true);
  }, [closeAllStudios]);

  const openProviders = useCallback(() => {
    closeAllStudios();
    setProviderStudioFocus(null);
    setProviderStudioAction(null);
    setProviderStudioOpen(true);
  }, [closeAllStudios]);

  const openGithub = useCallback(() => {
    closeAllStudios();
    setGithubStudioSession(currentSession?.id ?? null);
    setGithubStudioIssueId(null);
    setGithubStudioOpen(true);
  }, [closeAllStudios, currentSession?.id]);

  const openLinear = useCallback(() => {
    closeAllStudios();
    setLinearStudioFocus(null);
    setLinearStudioOpen(true);
  }, [closeAllStudios]);

  const openJira = useCallback(() => {
    closeAllStudios();
    setJiraStudioFocus(null);
    setJiraStudioOpen(true);
  }, [closeAllStudios]);

  const openSentry = useCallback(() => {
    closeAllStudios();
    setSentryStudioFocus(null);
    setSentryStudioOpen(true);
  }, [closeAllStudios]);

  const openGitlab = useCallback(() => {
    closeAllStudios();
    setGitlabStudioFocus(null);
    setGitlabStudioOpen(true);
  }, [closeAllStudios]);

  const openBitbucket = useCallback(() => {
    closeAllStudios();
    setBitbucketStudioOpen(true);
  }, [closeAllStudios]);

  const openSlack = useCallback(() => {
    closeAllStudios();
    setSlackStudioFocus(null);
    setSlackStudioOpen(true);
  }, [closeAllStudios]);

  const openInbox = useCallback(() => {
    closeAllStudios();
    setInboxStudioFocus(null);
    setInboxStudioOpen(true);
  }, [closeAllStudios]);

  const armDeleteConfirm = useCallback(() => {
    if (currentSession === null) {
      return;
    }
    setDeleteSessionId(currentSession.id);
    setDeleteOpen(true);
  }, [currentSession]);

  const armArchiveConfirm = useCallback(() => {
    if (currentSession === null) {
      return;
    }
    setArchiveSessionId(currentSession.id);
    setArchiveOpen(true);
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
    const onOpenSettings = (event: Event) => {
      const section = eventValue({ event, key: 'section' });
      closeAllStudios();
      setAppSettingsFocus(typeof section === 'string' ? section : undefined);
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
      const sessionId = eventValue({ event, key: 'sessionId' });
      const prNumber = eventValue({ event, key: 'prNumber' });
      const threadId = eventValue({ event, key: 'threadId' });
      const issueExternalId = eventValue({ event, key: 'issueExternalId' });
      const tab = eventValue({ event, key: 'tab' });
      closeAllStudios();
      setGithubStudioSession(isSessionId(sessionId) ? sessionId : null);
      setGithubStudioPrNumber(typeof prNumber === 'number' ? prNumber : null);
      setGithubStudioThreadId(typeof threadId === 'string' ? threadId : null);
      setGithubStudioIssueId(typeof issueExternalId === 'string' ? issueExternalId : null);
      setGithubStudioTab(tab === 'pull-requests' || tab === 'issues' ? tab : null);
      setGithubStudioOpen(true);
    };
    const onOpenPlanStudio = (event: Event) => {
      const sessionId = eventValue({ event, key: 'sessionId' });
      if (!isSessionId(sessionId) || sessionId === '') {
        return;
      }
      const planId = eventValue({ event, key: 'planId' });
      setWorkspaceSettingsOpen(false);
      setWorkspaceSettingsFocus(undefined);
      const state = useAppStore.getState();
      state.setFocusedPlanId(sessionId, isPlanId(planId) ? planId : null);
      state.setActiveLens(sessionId, 'plans');
    };
    const onOpenDiffViewer = (event: Event) => {
      const sessionId = eventValue({ event, key: 'sessionId' });
      const workingDir = eventValue({ event, key: 'workingDir' });
      const detail = {
        sessionId: isSessionId(sessionId) ? sessionId : undefined,
        workingDir: typeof workingDir === 'string' ? workingDir : undefined,
      };
      const resolved = resolveOpenDiffViewerEvent({ detail });
      if (resolved === null) {
        return;
      }
      setWorkspaceSettingsOpen(false);
      setWorkspaceSettingsFocus(undefined);
      useAppStore.getState().openDiffLens(resolved.sessionId, resolved.focus);
    };
    const onOpenProviderStudio = (event: Event) => {
      const providerId = eventValue({ event, key: 'providerId' });
      const action = eventValue({ event, key: 'action' });
      closeAllStudios();
      setProviderStudioFocus(isProviderId(providerId) ? providerId : null);
      setProviderStudioAction(isProviderLifecycleAction(action) ? action : null);
      setProviderStudioOpen(true);
    };
    const onOpenBudgetStudio = (event: Event) => {
      const scope = eventValue({ event, key: 'scope' });
      closeAllStudios();
      setBudgetStudioScope(isBudgetScope(scope) ? scope : undefined);
      setBudgetStudioOpen(true);
    };
    const openIssueStudio = ({ event, setFocus, setOpen }: OpenIssueStudioParams) => {
      const issueExternalId = eventValue({ event, key: 'issueExternalId' });
      closeAllStudios();
      setFocus(typeof issueExternalId === 'string' ? issueExternalId : null);
      setOpen(true);
    };
    const onRevealChat = () => {
      setWorkspaceSettingsOpen(false);
      setWorkspaceSettingsFocus(undefined);
      const state = useAppStore.getState();
      const sessionId = state.currentSessionId;
      if (sessionId !== null) {
        state.setSessionStudio(sessionId, null);
      }
    };
    const onOpenNotificationsStudio = () => {
      closeAllStudios();
      setNotificationsStudioOpen(true);
    };
    const onOpenLinearStudio = (event: Event) =>
      openIssueStudio({ event, setFocus: setLinearStudioFocus, setOpen: setLinearStudioOpen });
    const onOpenSentryStudio = (event: Event) =>
      openIssueStudio({ event, setFocus: setSentryStudioFocus, setOpen: setSentryStudioOpen });
    const onOpenGitlabStudio = (event: Event) =>
      openIssueStudio({ event, setFocus: setGitlabStudioFocus, setOpen: setGitlabStudioOpen });
    const onOpenJiraStudio = (event: Event) =>
      openIssueStudio({ event, setFocus: setJiraStudioFocus, setOpen: setJiraStudioOpen });
    const onOpenInboxStudio = (event: Event) => {
      const workspaceId = eventValue({ event, key: 'workspaceId' });
      const provider = eventValue({ event, key: 'provider' });
      const kind = eventValue({ event, key: 'kind' });
      const recordKey = eventValue({ event, key: 'recordKey' });
      closeAllStudios();
      setInboxStudioFocus({
        provider: isInboxProvider(provider) ? provider : null,
        kind: isInboxKind(kind) ? kind : null,
        recordKey: typeof recordKey === 'string' ? recordKey : null,
      });
      const openStudio = () => setInboxStudioOpen(true);
      if (isWorkspaceId(workspaceId) && workspaceId !== useAppStore.getState().currentWorkspaceId) {
        void useAppStore.getState().setCurrentWorkspace(workspaceId).then(openStudio, openStudio);
        return;
      }
      openStudio();
    };
    const onAddWorkspace = () => openAddWorkspace();
    const onPairDevice = () => setCompanionOpen(true);
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
    window.addEventListener('goodboy:open-inbox', onOpenInboxStudio);
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
      window.removeEventListener('goodboy:open-inbox', onOpenInboxStudio);
      window.removeEventListener('goodboy:reveal-chat', onRevealChat);
      window.removeEventListener('goodboy:add-workspace', onAddWorkspace);
      window.removeEventListener('goodboy:open-pair-device', onPairDevice);
    };
  }, [closeAllStudios, openAddWorkspace]);

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
    const handler = () => openWorkflows();
    window.addEventListener('goodboy:open-workflow-studio', handler);
    return () => window.removeEventListener('goodboy:open-workflow-studio', handler);
  }, [openWorkflows]);

  useEffect(() => {
    const handler = (event: Event) => {
      const section = eventValue({ event, key: 'section' });
      if (workspaceSettingsOpen && section === undefined) {
        setWorkspaceSettingsOpen(false);
        setWorkspaceSettingsFocus(undefined);
        return;
      }
      setWorkspaceSettingsFocus(typeof section === 'string' ? section : undefined);
      clearSessionStudio();
      setWorkspaceSettingsOpen(true);
    };
    window.addEventListener('goodboy:open-workspace-settings', handler);
    return () => window.removeEventListener('goodboy:open-workspace-settings', handler);
  }, [clearSessionStudio, workspaceSettingsOpen]);

  useEffect(() => {
    const handler = (event: Event) => {
      const sessionId = eventValue({ event, key: 'sessionId' });
      if (!isSessionId(sessionId) || sessionId === '') {
        return;
      }
      const prNumber = eventValue({ event, key: 'prNumber' });
      const threadId = eventValue({ event, key: 'threadId' });
      setWorkspaceSettingsOpen(false);
      setWorkspaceSettingsFocus(undefined);
      setSessionStudio(sessionId, {
        kind: 'github',
        prNumber: typeof prNumber === 'number' ? prNumber : undefined,
        threadId: typeof threadId === 'string' ? threadId : undefined,
      });
    };
    window.addEventListener('goodboy:open-github-session', handler);
    return () => window.removeEventListener('goodboy:open-github-session', handler);
  }, [setSessionStudio]);

  useEffect(() => {
    const handler = (event: Event) => {
      const sessionId = eventValue({ event, key: 'sessionId' });
      if (!isSessionId(sessionId) || sessionId === '') {
        return;
      }
      setWorkspaceSettingsOpen(false);
      setWorkspaceSettingsFocus(undefined);
      setSessionStudio(sessionId, { kind: 'mr' });
    };
    window.addEventListener('goodboy:open-gitlab-mr', handler);
    return () => window.removeEventListener('goodboy:open-gitlab-mr', handler);
  }, [setSessionStudio]);

  useEffect(() => {
    const handler = (event: Event) => {
      const sessionId = eventValue({ event, key: 'sessionId' });
      if (!isSessionId(sessionId) || sessionId === '') {
        return;
      }
      setWorkspaceSettingsOpen(false);
      setWorkspaceSettingsFocus(undefined);
      setSessionStudio(sessionId, { kind: 'bitbucket' });
    };
    window.addEventListener('goodboy:open-bitbucket-pr', handler);
    return () => window.removeEventListener('goodboy:open-bitbucket-pr', handler);
  }, [setSessionStudio]);

  useEffect(() => {
    const handler = (event: Event) => {
      const sessionId = eventValue({ event, key: 'sessionId' });
      if (!isSessionId(sessionId) || sessionId === '') {
        return;
      }
      setWorkspaceSettingsOpen(false);
      setWorkspaceSettingsFocus(undefined);
      setSessionStudio(sessionId, { kind: 'workflow' });
    };
    window.addEventListener('goodboy:open-workflow-builder', handler);
    return () => window.removeEventListener('goodboy:open-workflow-builder', handler);
  }, [setSessionStudio]);

  useEffect(() => {
    const handler = () => {
      if (currentWorkspace === null) {
        return;
      }
      setWorkspaceSettingsOpen(false);
      setWorkspaceSettingsFocus(undefined);
      clearSessionStudio();
      setGithubStudioOpen(false);
      if (currentSession !== null && isSessionSidebarCollapsed) {
        pinSessionSidebar();
      }
    };
    window.addEventListener('goodboy:new-session', handler);
    return () => window.removeEventListener('goodboy:new-session', handler);
  }, [
    clearSessionStudio,
    currentSession,
    currentWorkspace,
    isSessionSidebarCollapsed,
    pinSessionSidebar,
  ]);

  useEffect(() => {
    setWorkspaceSettingsOpen(false);
  }, [currentWorkspace?.id]);

  useEffect(() => {
    const handler = () => openPalette();
    window.addEventListener(OPEN_COMMAND_PALETTE_EVENT, handler);
    return () => window.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, handler);
  }, [openPalette]);

  const commitDiffLoader = useCallback(async () => {
    if (commitDiff === null) {
      return '';
    }
    if (currentSessionWorktree !== null) {
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

  const closeAppSettings = useCallback(() => {
    setAppSettingsOpen(false);
    setAppSettingsFocus(undefined);
  }, []);
  const closeWorkspaceSettings = useCallback(() => {
    setWorkspaceSettingsOpen(false);
    setWorkspaceSettingsFocus(undefined);
  }, []);
  const closeGuideStudio = useCallback(() => setGuideStudioOpen(false), []);
  const closeReportIssueStudio = useCallback(() => setReportIssueStudioOpen(false), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const closeAddWorkspace = useCallback(() => setAddWorkspaceOpen(false), []);
  const offerWorkspaceRepo = useCallback(() => setConvertWorkspaceOpen(true), []);
  const closeConvertWorkspace = useCallback(() => setConvertWorkspaceOpen(false), []);
  const closeWorkflowStudio = useCallback(() => setWorkflowStudioOpen(false), []);
  const closeGithubStudio = useCallback(() => setGithubStudioOpen(false), []);
  const closeProviderStudio = useCallback(() => {
    setProviderStudioOpen(false);
    setProviderStudioAction(null);
  }, []);
  const closeBudgetStudio = useCallback(() => setBudgetStudioOpen(false), []);
  const closeImpactStudio = useCallback(() => setImpactStudioOpen(false), []);
  const closeChangelogStudio = useCallback(() => setChangelogStudioOpen(false), []);
  const closeNotificationsStudio = useCallback(() => setNotificationsStudioOpen(false), []);
  const closeLinearStudio = useCallback(() => setLinearStudioOpen(false), []);
  const closeSentryStudio = useCallback(() => setSentryStudioOpen(false), []);
  const closeGitlabStudio = useCallback(() => setGitlabStudioOpen(false), []);
  const closeJiraStudio = useCallback(() => setJiraStudioOpen(false), []);
  const closeBitbucketStudio = useCallback(() => setBitbucketStudioOpen(false), []);
  const closeSlackStudio = useCallback(() => setSlackStudioOpen(false), []);
  const closeInboxStudio = useCallback(() => setInboxStudioOpen(false), []);
  const closeCommitDiff = useCallback(() => setCommitDiff(null), [setCommitDiff]);
  const closeDeleteConfirm = useCallback(() => {
    setDeleteOpen(false);
    setDeleteSessionId(null);
  }, []);
  const closeArchiveConfirm = useCallback(() => {
    setArchiveOpen(false);
    setArchiveSessionId(null);
  }, []);
  const closeCompanion = useCallback(() => setCompanionOpen(false), []);
  const openSettingsFromPalette = useCallback(() => {
    openSettings();
    setPaletteOpen(false);
  }, [openSettings]);
  const closePaletteForNewSession = useCallback(() => setPaletteOpen(false), []);
  const openProvidersFromPalette = useCallback(() => {
    openProviders();
    setPaletteOpen(false);
  }, [openProviders]);
  const openShortcutHelpFromPalette = useCallback(() => {
    openShortcutHelp();
    setPaletteOpen(false);
  }, [openShortcutHelp]);

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
                            : inboxStudioOpen
                              ? 'inbox'
                              : appSettingsOpen
                                ? 'settings'
                                : guideStudioOpen
                                  ? 'guide'
                                  : null;

  const workspaceSettingsOverlay: ReactNode =
    workspaceSettingsOpen && currentWorkspace !== null
      ? createElement(WorkspaceSettingsPane, {
          workspaceId: currentWorkspace.id,
          workspaceName: currentWorkspace.name,
          initialSection: workspaceSettingsFocus,
          onClose: closeWorkspaceSettings,
        })
      : undefined;

  const overlays: ReactNode = createElement(AppOverlayRouter, {
    currentWorkspace,
    workspaceProjectRoot,
    isWorkspaceLauncherBranch,
    companionOpen,
    appSettingsOpen,
    appSettingsFocus,
    guideStudioOpen,
    reportIssueStudioOpen,
    deleteOpen,
    deleteTargetSession,
    archiveOpen,
    archiveTargetSession,
    paletteOpen,
    palettePrefix,
    addWorkspaceOpen,
    convertWorkspaceOpen,
    workflowStudioOpen,
    linearStudioOpen,
    linearStudioFocus,
    sentryStudioOpen,
    sentryStudioFocus,
    gitlabStudioOpen,
    gitlabStudioFocus,
    jiraStudioOpen,
    jiraStudioFocus,
    bitbucketStudioOpen,
    slackStudioOpen,
    slackStudioFocus,
    inboxStudioOpen,
    inboxStudioFocus,
    providerStudioOpen,
    providerStudioFocus,
    providerStudioAction,
    githubStudioOpen,
    githubStudioSession,
    githubStudioPrNumber,
    githubStudioThreadId,
    githubStudioIssueId,
    githubStudioTab,
    budgetStudioOpen,
    budgetStudioScope,
    impactStudioOpen,
    changelogStudioOpen,
    notificationsStudioOpen,
    commitDiff,
    commitDiffLoader,
    closeAppSettings,
    closeGuideStudio,
    closeReportIssueStudio,
    closePalette,
    openSettingsFromPalette,
    closePaletteForNewSession,
    openProvidersFromPalette,
    openShortcutHelpFromPalette,
    closeAddWorkspace,
    offerWorkspaceRepo,
    closeConvertWorkspace,
    closeWorkflowStudio,
    closeGithubStudio,
    closeProviderStudio,
    closeBudgetStudio,
    closeImpactStudio,
    closeChangelogStudio,
    closeNotificationsStudio,
    closeLinearStudio,
    closeSentryStudio,
    closeGitlabStudio,
    closeJiraStudio,
    closeBitbucketStudio,
    closeSlackStudio,
    closeInboxStudio,
    closeCommitDiff,
    closeDeleteConfirm,
    closeArchiveConfirm,
    closeCompanion,
  });

  return {
    activeStudio,
    armArchiveConfirm,
    armDeleteConfirm,
    openAddWorkspace,
    openBitbucket,
    openBudget,
    openChangelog,
    openGithub,
    openGitlab,
    openImpact,
    openInbox,
    openJira,
    openLinear,
    openPalette,
    openProviders,
    openSentry,
    openSettings,
    openShortcutHelp,
    openSlack,
    openWorkflows,
    overlays,
    workspaceSettingsOverlay,
  };
};
