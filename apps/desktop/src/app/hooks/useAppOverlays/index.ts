import { createElement, useCallback, useState, type ReactNode } from 'react';
import { useEscapeLayer } from '@goodboy/ui';
import type { Session, SessionId, Workspace } from '@goodboy/types';
import type { IntegrationGlyphProvider } from '../../../features/integrations/components/IntegrationGlyph';
import type { SettingsScopeChange } from '../../../features/settings/components/SettingsStudio/types';
import type { ImpactScope } from '../../../features/impact/lib';
import { markStepComplete } from '../../../features/onboarding/onboarding-store';
import {
  useAppStore,
  useSessionById,
  type InboxStudioFocus,
  type StudioPlace,
} from '../../../store';
import { AppOverlayRouter, AppStudio } from '../../components/AppOverlayRouter';
import { clearCurrentSessionStudio } from './clearCurrentSessionStudio';
import { footerTarget, type ConnectedIntegrations } from './overlayState';
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
}: Params) => {
  const overlay = useAppStore((state) => state.appStudio);
  const openStudio = useAppStore((state) => state.openStudio);
  const amendStudio = useAppStore((state) => state.amendStudio);
  const closeStudio = useAppStore((state) => state.closeStudio);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteSessionId, setDeleteSessionId] = useState<SessionId | null>(null);
  const deleteTargetSession = useSessionById(deleteSessionId);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [palettePrefix, setPalettePrefix] = useState('');
  const [convertWorkspaceOpen, setConvertWorkspaceOpen] = useState(false);
  useCommitDiff();

  const open = useCallback(
    ({ overlay: next }: OpenParams) => openStudio({ studio: next }),
    [openStudio],
  );
  const close = useCallback(() => closeStudio(), [closeStudio]);

  const openPalette = useCallback((prefix = '') => {
    setPalettePrefix(prefix);
    setPaletteOpen(true);
    markStepComplete('palette');
  }, []);

  useStudioEvents({ open, close, openPalette });
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

  const hasWorkspace = currentWorkspace !== null;
  const openSettings = useCallback(() => {
    clearCurrentSessionStudio();
    open({
      overlay: { kind: 'settings', focus: { scope: hasWorkspace ? 'workspace' : 'app' } },
    });
  }, [hasWorkspace, open]);

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

  const openShortcutHelp = useCallback(
    () => open({ overlay: { kind: 'settings', focus: { scope: 'app', section: 'shortcuts' } } }),
    [open],
  );

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
    ({ scope, section }: SettingsScopeChange) =>
      amendStudio({
        studio: {
          kind: 'settings',
          focus: section === undefined ? { scope } : { scope, section },
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

  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const offerWorkspaceRepo = useCallback(() => setConvertWorkspaceOpen(true), []);
  const closeConvertWorkspace = useCallback(() => setConvertWorkspaceOpen(false), []);
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
          currentWorkspace,
          workspaceProjectRoot,
          offerWorkspaceRepo,
        });

  const layers: ReactNode = createElement(AppOverlayRouter, {
    overlay,
    close,
    onSettingsScopeChange: changeSettingsScope,
    onInboxFocusChange: changeInboxFocus,
    onImpactScopeChange: changeImpactScope,
    currentWorkspace,
    isWorkspaceLauncherBranch,
    deleteOpen,
    deleteTargetSession,
    paletteOpen,
    palettePrefix,
    convertWorkspaceOpen,
    closePalette,
    offerWorkspaceRepo,
    closeConvertWorkspace,
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
