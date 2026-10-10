import { createElement, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useEscapeLayer } from '@goodboy/ui';
import type { Session, SessionId, Workspace } from '@goodboy/types';
import type { IntegrationGlyphProvider } from '../../../features/integrations/components/IntegrationGlyph';
import type { SettingsScopeChange } from '../../../features/settings/settingsFocus';
import { DEV_PROJECT_SECTION_ID } from '../../../features/settings/components/SettingsStudio/workspacePages';
import type { ImpactScope } from '../../../features/impact/lib';
import type { ChangelogScreen } from '../../../features/changelog/changelogScreens';
import { resolveChangelogScreenOverlay } from '../../../features/changelog/resolveChangelogScreenOverlay';
import {
  useAppStore,
  useSessionById,
  type InboxStudioFocus,
  type StudioPlace,
} from '../../../store';
import { AppOverlayRouter, AppStudio } from '../../components/AppOverlayRouter';
import type { StudioPlacement } from '../../components/StudioFrame/studioPlacement';
import { clearCurrentSessionStudio } from './clearCurrentSessionStudio';
import { footerTarget, type ConnectedIntegrations } from './overlayState';
import type { OpenPaletteParams, PaletteRequest } from '../../../features/palette/paletteModeTypes';
import { useCommitDiff } from './useCommitDiff';
import { useSessionSurfaceEvents } from './useSessionSurfaceEvents';
import { useStudioEvents } from './useStudioEvents';

type Params = {
  readonly connected: ConnectedIntegrations;
  readonly currentSession: Session | null;
  readonly currentWorkspace: Workspace | null;
  readonly workspaceProjectRoot: string | null;
  readonly isSessionSidebarCollapsed: boolean;
  readonly isWorkspaceLauncherBranch: boolean;
  readonly pinSessionSidebar: () => void;
  readonly studioPlacement?: StudioPlacement;
  readonly settingsColumnSlot?: HTMLElement | null;
};

type OpenParams = {
  readonly overlay: StudioPlace;
};

type OpenIntegrationParams = {
  readonly provider: IntegrationGlyphProvider;
};

export const useAppOverlays = ({
  connected,
  currentSession,
  currentWorkspace,
  workspaceProjectRoot,
  isSessionSidebarCollapsed,
  isWorkspaceLauncherBranch,
  pinSessionSidebar,
  studioPlacement = 'cover',
  settingsColumnSlot = null,
}: Params) => {
  const overlay = useAppStore((state) => state.appStudio);
  const openStudio = useAppStore((state) => state.openStudio);
  const amendStudio = useAppStore((state) => state.amendStudio);
  const switchStudio = useAppStore((state) => state.switchStudio);
  const closeStudio = useAppStore((state) => state.closeStudio);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSessionId, setDeleteSessionId] = useState<SessionId | null>(null);
  const deleteTargetSession = useSessionById(deleteSessionId);
  const [palette, setPalette] = useState<PaletteRequest | null>(null);
  const [isRepoOfferPending, setIsRepoOfferPending] = useState(false);
  useCommitDiff();

  const open = useCallback(
    ({ overlay: next }: OpenParams) => openStudio({ studio: next }),
    [openStudio],
  );
  const goTo = useCallback(
    ({ overlay: next }: OpenParams) => switchStudio({ studio: next }),
    [switchStudio],
  );
  const close = useCallback(() => closeStudio(), [closeStudio]);

  const openPalette = useCallback(({ mode = 'commands', query = '' }: OpenPaletteParams = {}) => {
    setPalette((current) => (current === null ? { mode, query } : { ...current, mode }));
  }, []);

  useStudioEvents({ open, goTo, close, openPalette });
  useSessionSurfaceEvents({
    close,
    currentSession,
    currentWorkspace,
    isSessionSidebarCollapsed,
    pinSessionSidebar,
  });

  const dismissDelete = useCallback(() => setDeleteOpen(false), []);
  useEscapeLayer(dismissDelete, deleteOpen);

  const openAddWorkspace = useCallback(() => open({ overlay: { kind: 'addWorkspace' } }), [open]);

  const openSettings = useCallback(() => {
    clearCurrentSessionStudio();
    goTo({
      overlay: { kind: 'settings', focus: { scope: 'home' } },
    });
  }, [goTo]);

  const openSpend = useCallback(
    () => goTo({ overlay: { kind: 'impact', scope: { kind: 'spend' } } }),
    [goTo],
  );

  const openImpact = useCallback(() => goTo({ overlay: { kind: 'impact', scope: null } }), [goTo]);

  const openChangelog = useCallback(() => goTo({ overlay: { kind: 'changelog' } }), [goTo]);

  const openGuide = useCallback(() => goTo({ overlay: { kind: 'guide' } }), [goTo]);

  const onOpenChangelogScreen = useCallback(
    ({ screen }: { readonly screen: ChangelogScreen }) =>
      open({ overlay: resolveChangelogScreenOverlay({ screen }) }),
    [open],
  );

  const openWorkflows = useCallback(() => goTo({ overlay: { kind: 'workflow' } }), [goTo]);

  const openProviders = useCallback(
    () => goTo({ overlay: { kind: 'settings', focus: { scope: 'providers' } } }),
    [goTo],
  );

  const openInbox = useCallback(() => goTo({ overlay: { kind: 'inbox', focus: null } }), [goTo]);

  const openChat = useCallback(() => goTo({ overlay: { kind: 'chat', chatId: null } }), [goTo]);

  const openShortcutHelp = useCallback(
    () => goTo({ overlay: { kind: 'settings', focus: { scope: 'app', section: 'shortcuts' } } }),
    [goTo],
  );

  const openIntegration = useCallback(
    ({ provider }: OpenIntegrationParams) => {
      if (!connected[provider]) {
        goTo({ overlay: { kind: 'settings', focus: { scope: 'tools', tool: provider } } });
        return;
      }
      goTo({
        overlay: {
          kind: 'inbox',
          focus: { provider, kind: null, recordKey: null, sessionId: null },
        },
      });
    },
    [connected, goTo],
  );

  const changeSettingsScope = useCallback(
    ({ scope, section, tool, provider }: SettingsScopeChange) =>
      amendStudio({
        studio: {
          kind: 'settings',
          focus: {
            scope,
            ...(section !== undefined && { section }),
            ...(tool !== undefined && { tool }),
            ...(provider !== undefined && { provider }),
          },
        },
      }),
    [amendStudio],
  );

  const changeInboxFocus = useCallback(
    (focus: InboxStudioFocus) => amendStudio({ studio: { kind: 'inbox', focus } }),
    [amendStudio],
  );

  const changeImpactScope = useCallback(
    (scope: ImpactScope) => amendStudio({ studio: { kind: 'impact', scope } }),
    [amendStudio],
  );

  const armDeleteConfirm = useCallback(() => {
    if (currentSession === null) {
      return;
    }
    setDeleteSessionId(currentSession.id);
    setDeleteOpen(true);
  }, [currentSession]);

  const closePalette = useCallback(() => setPalette(null), []);
  const offerWorkspaceRepo = useCallback(() => setIsRepoOfferPending(true), []);

  useEffect(() => {
    if (!isRepoOfferPending || overlay !== null || currentWorkspace === null) {
      return;
    }
    setIsRepoOfferPending(false);
    openStudio({
      studio: {
        kind: 'settings',
        focus: { scope: 'workspace', section: DEV_PROJECT_SECTION_ID },
      },
    });
  }, [isRepoOfferPending, overlay, currentWorkspace, openStudio]);
  const closeDeleteConfirm = useCallback(() => {
    setDeleteOpen(false);
    setDeleteSessionId(null);
  }, []);

  const studio: ReactNode =
    isWorkspaceLauncherBranch || overlay === null
      ? null
      : createElement(AppStudio, {
          overlay,
          close,
          onSettingsScopeChange: changeSettingsScope,
          onInboxFocusChange: changeInboxFocus,
          onImpactScopeChange: changeImpactScope,
          onOpenChangelogScreen,
          currentWorkspace,
          workspaceProjectRoot,
          offerWorkspaceRepo,
          placement: studioPlacement,
          settingsColumnSlot,
        });

  const layers: ReactNode = createElement(AppOverlayRouter, {
    overlay,
    close,
    onSettingsScopeChange: changeSettingsScope,
    onInboxFocusChange: changeInboxFocus,
    onImpactScopeChange: changeImpactScope,
    onOpenChangelogScreen,
    currentWorkspace,
    isWorkspaceLauncherBranch,
    deleteOpen,
    deleteTargetSession,
    palette,
    closePalette,
    offerWorkspaceRepo,
    closeDeleteConfirm,
  });

  return {
    footer: footerTarget({ overlay, connected }),
    settingsProviderId:
      overlay?.kind === 'settings' && overlay.focus.scope === 'providers'
        ? (overlay.focus.provider ?? null)
        : null,
    armDeleteConfirm,
    openAddWorkspace,
    openChangelog,
    openChat,
    openGuide,
    openImpact,
    openInbox,
    openIntegration,
    openPalette,
    openProviders,
    openSettings,
    openShortcutHelp,
    openSpend,
    openWorkflows,
    studio,
    layers,
  };
};
