import { createElement, useCallback, useEffect, useState, type ReactNode } from 'react';
import type { Session, SessionId, Workspace } from '@goodboy/types';
import type { IntegrationGlyphProvider } from '../../../features/integrations/components/IntegrationGlyph';
import type { SettingsStudioScope } from '../../../features/settings/components/SettingsStudio/types';
import { markStepComplete } from '../../../features/onboarding/onboarding-store';
import { useSessionById } from '../../../store';
import { AppOverlayRouter } from '../../components/AppOverlayRouter';
import { clearCurrentSessionStudio } from './clearCurrentSessionStudio';
import { footerTarget, type ConnectedIntegrations, type Overlay } from './overlayState';
import { useCloseOverlayOnNavigation } from './useCloseOverlayOnNavigation';
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
  readonly overlay: Overlay;
};

type OpenIntegrationParams = {
  readonly provider: IntegrationGlyphProvider;
};

type ScopeChangeParams = {
  readonly scope: SettingsStudioScope;
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
  const { commitDiff, commitDiffLoader, closeCommitDiff } = useCommitDiff();

  const open = useCallback(({ overlay: next }: OpenParams) => setOverlay(next), []);
  const close = useCallback(() => setOverlay(null), []);

  const openPalette = useCallback((prefix = '') => {
    setPalettePrefix(prefix);
    setPaletteOpen(true);
    markStepComplete('palette');
  }, []);

  useStudioEvents({ open, close, openPalette });
  useCloseOverlayOnNavigation({ close });
  useSessionSurfaceEvents({
    close,
    currentSession,
    currentWorkspace,
    isSessionSidebarCollapsed,
    pinSessionSidebar,
  });

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

  const openAddWorkspace = useCallback(() => open({ overlay: { kind: 'addWorkspace' } }), [open]);

  const openSettings = useCallback(() => {
    clearCurrentSessionStudio();
    open({ overlay: { kind: 'settings', focus: { scope: 'app' } } });
  }, [open]);

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

  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const offerWorkspaceRepo = useCallback(() => setConvertWorkspaceOpen(true), []);
  const closeConvertWorkspace = useCallback(() => setConvertWorkspaceOpen(false), []);
  const closeDeleteConfirm = useCallback(() => {
    setDeleteOpen(false);
    setDeleteSessionId(null);
  }, []);

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
