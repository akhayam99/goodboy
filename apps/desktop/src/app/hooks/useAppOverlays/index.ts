import { createElement, useCallback, useState, type ReactNode } from 'react';
import { useEscapeLayer } from '@goodboy/ui';
import type { Session, SessionId, Workspace } from '@goodboy/types';
import type { SettingsScopeChange } from '../../../features/settings/settingsFocus';
import type { ImpactScope } from '../../../features/impact/lib';
import type { ChangelogScreen } from '../../../features/changelog/changelogScreens';
import { resolveChangelogScreenOverlay } from '../../../features/changelog/resolveChangelogScreenOverlay';
import {
  useAppStore,
  useSessionById,
  type InboxStudioFocus,
  type StudioPlace,
} from '../../../store';
import { openDestination } from '../../../shared/navigation/openDestination';
import { AppOverlayRouter } from '../../components/AppOverlayRouter';
import { AppStudio } from '../../components/AppOverlayRouter/AppStudio';
import type { OpenPaletteParams, PaletteRequest } from '../../../features/palette/paletteModeTypes';
import { useCommitDiff } from './useCommitDiff';
import { useSessionSurfaceEvents } from './useSessionSurfaceEvents';
import { useStudioEvents } from './useStudioEvents';

type Params = {
  readonly currentSession: Session | null;
  readonly currentWorkspace: Workspace | null;
  readonly workspaceProjectRoot: string | null;
  readonly isWorkspaceLauncherBranch: boolean;
};

type OpenParams = {
  readonly overlay: StudioPlace;
};

export const useAppOverlays = ({
  currentSession,
  currentWorkspace,
  workspaceProjectRoot,
  isWorkspaceLauncherBranch,
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
  useSessionSurfaceEvents({ close, currentWorkspace });

  const dismissDelete = useCallback(() => setDeleteOpen(false), []);
  useEscapeLayer(dismissDelete, deleteOpen);

  const openAddWorkspace = useCallback(() => open({ overlay: { kind: 'addWorkspace' } }), [open]);

  const openSettings = useCallback(() => {
    goTo({
      overlay: { kind: 'settings', focus: { scope: 'home' } },
    });
  }, [goTo]);

  const openSpend = useCallback(
    () => goTo({ overlay: { kind: 'impact', scope: { kind: 'spend' } } }),
    [goTo],
  );

  const openChangelog = useCallback(() => goTo({ overlay: { kind: 'changelog' } }), [goTo]);

  const openGuide = useCallback(() => goTo({ overlay: { kind: 'guide' } }), [goTo]);

  const onOpenChangelogScreen = useCallback(
    ({ screen }: { readonly screen: ChangelogScreen }) =>
      open({ overlay: resolveChangelogScreenOverlay({ screen }) }),
    [open],
  );

  const openWorkflows = useCallback(() => openDestination({ id: 'workflows' }), []);

  const openProviders = useCallback(
    () => goTo({ overlay: { kind: 'settings', focus: { scope: 'providers' } } }),
    [goTo],
  );

  const openInbox = useCallback(() => openDestination({ id: 'inbox' }), []);

  const openChat = useCallback(() => openDestination({ id: 'chat' }), []);

  const openNewChat = useCallback(() => goTo({ overlay: { kind: 'chat', chatId: null } }), [goTo]);

  const openMonitoring = useCallback(() => openDestination({ id: 'monitoring' }), []);

  const openImpact = useCallback(() => openDestination({ id: 'impact' }), []);

  const openShortcutHelp = useCallback(
    () => goTo({ overlay: { kind: 'settings', focus: { scope: 'app', section: 'shortcuts' } } }),
    [goTo],
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
          placement: 'content',
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
    closeDeleteConfirm,
  });

  return {
    settingsProviderId:
      overlay?.kind === 'settings' && overlay.focus.scope === 'providers'
        ? (overlay.focus.provider ?? null)
        : null,
    armDeleteConfirm,
    openAddWorkspace,
    openChangelog,
    openChat,
    openGuide,
    openInbox,
    openPalette,
    openProviders,
    openSettings,
    openShortcutHelp,
    openSpend,
    openNewChat,
    openMonitoring,
    openImpact,
    openWorkflows,
    studio,
    layers,
  };
};
