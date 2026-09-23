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
import type { IntegrationGlyphProvider } from '../../../features/integrations/components/IntegrationGlyph';
import { AppOverlayRouter } from '../../components/AppOverlayRouter';
import type { ImpactScope } from '../../../features/impact/lib';
import { IMPACT_STUDIO_EVENT } from '../../../features/impact/openImpactStudio';
import type { SettingsStudioScope } from '../../../features/settings/components/SettingsStudio/types';
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
import { footerTarget, type ConnectedIntegrations, type Overlay } from './overlayState';

type Params = {
  readonly connected: ConnectedIntegrations;
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

type OpenParams = {
  readonly overlay: Overlay;
};

type OpenIntegrationParams = {
  readonly provider: IntegrationGlyphProvider;
};

type ScopeChangeParams = {
  readonly scope: SettingsStudioScope;
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

const isSettingsScope = (value: unknown): value is SettingsStudioScope =>
  value === 'app' || value === 'workspace' || value === 'providers' || value === 'tools';

const isImpactScope = (value: unknown): value is ImpactScope => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const kind: unknown = Reflect.get(value, 'kind');
  if (kind === 'overview' || kind === 'shipped' || kind === 'flow' || kind === 'efficiency') {
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

const settingsOverlayFromEvent = (event: Event): Overlay => {
  const scope = eventValue({ event, key: 'scope' });
  const tool = eventValue({ event, key: 'tool' });
  const section = eventValue({ event, key: 'section' });
  const provider =
    eventValue({ event, key: 'provider' }) ?? eventValue({ event, key: 'providerId' });
  const action = eventValue({ event, key: 'action' });
  return {
    kind: 'settings',
    focus: {
      scope: isSettingsScope(scope) ? scope : 'app',
      tool: isInboxProvider(tool) ? tool : undefined,
      section: typeof section === 'string' ? section : undefined,
      provider: isProviderId(provider) ? provider : undefined,
      action: isProviderLifecycleAction(action) ? action : undefined,
    },
  };
};

export const useAppOverlays = ({
  connected,
  currentSession,
  currentWorkspace,
  workspaceProjectRoot,
  isSessionSidebarCollapsed,
  isWorkspaceLauncherBranch,
  pinSessionSidebar,
}: Params) => {
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSessionId, setDeleteSessionId] = useState<SessionId | null>(null);
  const deleteTargetSession = useSessionById(deleteSessionId);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [palettePrefix, setPalettePrefix] = useState('');
  const [convertWorkspaceOpen, setConvertWorkspaceOpen] = useState(false);
  const setSessionStudio = useAppStore((state) => state.setSessionStudio);
  const { commitDiff, setCommitDiff } = useCommitLinkInterceptor();
  const currentSessionId = useAppStore((state) => state.currentSessionId);
  const currentSessionWorktree = useAppStore((state) =>
    currentSessionId === null
      ? null
      : (resolveSessionRepo({ state, sessionId: currentSessionId })?.worktreePath ?? null),
  );

  const open = useCallback(({ overlay: next }: OpenParams) => setOverlay(next), []);
  const close = useCallback(() => setOverlay(null), []);

  const clearSessionStudio = useCallback(() => {
    const sessionId = useAppStore.getState().currentSessionId;
    if (sessionId === null) {
      return;
    }
    useAppStore.getState().setSessionStudio(sessionId, null);
  }, []);

  const openAddWorkspace = useCallback(() => open({ overlay: { kind: 'addWorkspace' } }), [open]);

  const openSettings = useCallback(() => {
    clearSessionStudio();
    open({ overlay: { kind: 'settings', focus: { scope: 'app' } } });
  }, [clearSessionStudio, open]);

  const openSpend = useCallback(
    () => open({ overlay: { kind: 'impact', scope: { kind: 'overview' } } }),
    [open],
  );

  const openImpact = useCallback(() => open({ overlay: { kind: 'impact', scope: null } }), [open]);

  const openChangelog = useCallback(() => open({ overlay: { kind: 'changelog' } }), [open]);

  const openWorkflows = useCallback(() => open({ overlay: { kind: 'workflow' } }), [open]);

  const openProviders = useCallback(
    () => open({ overlay: { kind: 'settings', focus: { scope: 'providers' } } }),
    [open],
  );

  const openInbox = useCallback(() => open({ overlay: { kind: 'inbox', focus: null } }), [open]);

  const openIntegration = useCallback(
    ({ provider }: OpenIntegrationParams) => {
      if (!connected[provider]) {
        open({ overlay: { kind: 'settings', focus: { scope: 'tools', tool: provider } } });
        return;
      }
      open({
        overlay: {
          kind: 'inbox',
          focus: { provider, kind: null, recordKey: null, sessionId: null },
        },
      });
    },
    [connected, open],
  );

  const changeSettingsScope = useCallback(
    ({ scope }: ScopeChangeParams) => open({ overlay: { kind: 'settings', focus: { scope } } }),
    [open],
  );

  const armDeleteConfirm = useCallback(() => {
    if (currentSession === null) {
      return;
    }
    setDeleteSessionId(currentSession.id);
    setDeleteOpen(true);
  }, [currentSession]);

  const openShortcutHelp = useCallback(
    () => open({ overlay: { kind: 'settings', focus: { scope: 'app', section: 'shortcuts' } } }),
    [open],
  );

  const openPalette = useCallback((prefix = '') => {
    setPalettePrefix(prefix);
    setPaletteOpen(true);
    markStepComplete('palette');
  }, []);

  useEffect(() => {
    const onOpenSettings = (event: Event) => open({ overlay: settingsOverlayFromEvent(event) });
    const onOpenGuide = () => open({ overlay: { kind: 'guide' } });
    const onOpenReportIssue = () => open({ overlay: { kind: 'report' } });
    const onOpenPlanStudio = (event: Event) => {
      const sessionId = eventValue({ event, key: 'sessionId' });
      if (!isSessionId(sessionId) || sessionId === '') {
        return;
      }
      const planId = eventValue({ event, key: 'planId' });
      close();
      const state = useAppStore.getState();
      state.setFocusedPlanId(sessionId, isPlanId(planId) ? planId : null);
      state.setActiveLens(sessionId, 'plans');
    };
    const onOpenImpactStudio = (event: Event) => {
      const scope = eventValue({ event, key: 'scope' });
      open({ overlay: { kind: 'impact', scope: isImpactScope(scope) ? scope : null } });
    };
    const onRevealChat = () => {
      close();
      clearSessionStudio();
    };
    const onOpenNotificationsStudio = () => open({ overlay: { kind: 'notifications' } });
    const onOpenInboxStudio = (event: Event) => {
      const workspaceId = eventValue({ event, key: 'workspaceId' });
      const provider = eventValue({ event, key: 'provider' });
      const kind = eventValue({ event, key: 'kind' });
      const recordKey = eventValue({ event, key: 'recordKey' });
      const sessionId = eventValue({ event, key: 'sessionId' });
      const inbox: Overlay = {
        kind: 'inbox',
        focus: {
          provider: isInboxProvider(provider) ? provider : null,
          kind: isInboxKind(kind) ? kind : null,
          recordKey: typeof recordKey === 'string' ? recordKey : null,
          sessionId: isSessionId(sessionId) && sessionId !== '' ? sessionId : null,
        },
      };
      const openStudio = () => open({ overlay: inbox });
      if (isWorkspaceId(workspaceId) && workspaceId !== useAppStore.getState().currentWorkspaceId) {
        close();
        void useAppStore.getState().setCurrentWorkspace(workspaceId).then(openStudio, openStudio);
        return;
      }
      openStudio();
    };
    const onAddWorkspace = () => open({ overlay: { kind: 'addWorkspace' } });
    const onPairDevice = () => open({ overlay: { kind: 'companion' } });
    const onOpenWorkflowStudio = () => open({ overlay: { kind: 'workflow' } });
    window.addEventListener(NOTIFICATIONS_STUDIO_EVENT, onOpenNotificationsStudio);
    window.addEventListener('goodboy:open-settings', onOpenSettings);
    window.addEventListener('goodboy:open-guide', onOpenGuide);
    window.addEventListener(REPORT_ISSUE_STUDIO_EVENT, onOpenReportIssue);
    window.addEventListener('goodboy:open-plan-studio', onOpenPlanStudio);
    window.addEventListener(IMPACT_STUDIO_EVENT, onOpenImpactStudio);
    window.addEventListener('goodboy:open-inbox', onOpenInboxStudio);
    window.addEventListener('goodboy:reveal-chat', onRevealChat);
    window.addEventListener('goodboy:add-workspace', onAddWorkspace);
    window.addEventListener('goodboy:open-pair-device', onPairDevice);
    window.addEventListener('goodboy:open-workflow-studio', onOpenWorkflowStudio);
    return () => {
      window.removeEventListener(NOTIFICATIONS_STUDIO_EVENT, onOpenNotificationsStudio);
      window.removeEventListener('goodboy:open-settings', onOpenSettings);
      window.removeEventListener('goodboy:open-guide', onOpenGuide);
      window.removeEventListener(REPORT_ISSUE_STUDIO_EVENT, onOpenReportIssue);
      window.removeEventListener('goodboy:open-plan-studio', onOpenPlanStudio);
      window.removeEventListener(IMPACT_STUDIO_EVENT, onOpenImpactStudio);
      window.removeEventListener('goodboy:open-inbox', onOpenInboxStudio);
      window.removeEventListener('goodboy:reveal-chat', onRevealChat);
      window.removeEventListener('goodboy:add-workspace', onAddWorkspace);
      window.removeEventListener('goodboy:open-pair-device', onPairDevice);
      window.removeEventListener('goodboy:open-workflow-studio', onOpenWorkflowStudio);
    };
  }, [clearSessionStudio, close, open]);

  useEffect(() => {
    if (!deleteOpen) {
      return;
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }
      setDeleteOpen(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [deleteOpen]);

  useEffect(() => {
    const openSessionStudio = ({
      event,
      kind,
    }: {
      readonly event: Event;
      readonly kind: 'mr' | 'bitbucket' | 'workflow';
    }) => {
      const sessionId = eventValue({ event, key: 'sessionId' });
      if (!isSessionId(sessionId) || sessionId === '') {
        return;
      }
      close();
      setSessionStudio(sessionId, { kind });
    };
    const onGitlabMr = (event: Event) => openSessionStudio({ event, kind: 'mr' });
    const onBitbucketPr = (event: Event) => openSessionStudio({ event, kind: 'bitbucket' });
    const onWorkflowBuilder = (event: Event) => openSessionStudio({ event, kind: 'workflow' });
    window.addEventListener('goodboy:open-gitlab-mr', onGitlabMr);
    window.addEventListener('goodboy:open-bitbucket-pr', onBitbucketPr);
    window.addEventListener('goodboy:open-workflow-builder', onWorkflowBuilder);
    return () => {
      window.removeEventListener('goodboy:open-gitlab-mr', onGitlabMr);
      window.removeEventListener('goodboy:open-bitbucket-pr', onBitbucketPr);
      window.removeEventListener('goodboy:open-workflow-builder', onWorkflowBuilder);
    };
  }, [close, setSessionStudio]);

  useEffect(() => {
    const handler = () => {
      if (currentWorkspace === null) {
        return;
      }
      close();
      clearSessionStudio();
      if (currentSession !== null && isSessionSidebarCollapsed) {
        pinSessionSidebar();
      }
    };
    window.addEventListener('goodboy:new-session', handler);
    return () => window.removeEventListener('goodboy:new-session', handler);
  }, [
    clearSessionStudio,
    close,
    currentSession,
    currentWorkspace,
    isSessionSidebarCollapsed,
    pinSessionSidebar,
  ]);

  useEffect(() => {
    setOverlay((current) => (current?.kind === 'settings' ? null : current));
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

  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const offerWorkspaceRepo = useCallback(() => setConvertWorkspaceOpen(true), []);
  const closeConvertWorkspace = useCallback(() => setConvertWorkspaceOpen(false), []);
  const closeCommitDiff = useCallback(() => setCommitDiff(null), [setCommitDiff]);
  const closeDeleteConfirm = useCallback(() => {
    setDeleteOpen(false);
    setDeleteSessionId(null);
  }, []);
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

  const overlays: ReactNode = createElement(AppOverlayRouter, {
    overlay,
    close,
    onSettingsScopeChange: changeSettingsScope,
    currentWorkspace,
    workspaceProjectRoot,
    isWorkspaceLauncherBranch,
    deleteOpen,
    deleteTargetSession,
    paletteOpen,
    palettePrefix,
    convertWorkspaceOpen,
    commitDiff,
    commitDiffLoader,
    closePalette,
    openSettingsFromPalette,
    closePaletteForNewSession,
    openProvidersFromPalette,
    openShortcutHelpFromPalette,
    offerWorkspaceRepo,
    closeConvertWorkspace,
    closeCommitDiff,
    closeDeleteConfirm,
  });

  return {
    footer: footerTarget({ overlay, connected }),
    armDeleteConfirm,
    openAddWorkspace,
    openChangelog,
    openImpact,
    openInbox,
    openIntegration,
    openPalette,
    openProviders,
    openSettings,
    openShortcutHelp,
    openSpend,
    openWorkflows,
    overlays,
  };
};
