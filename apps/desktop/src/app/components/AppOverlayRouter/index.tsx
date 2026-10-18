import { Suspense, lazy, type ReactNode } from 'react';
import type { Session, Workspace } from '@goodboy/types';
import { DeleteSessionOverlay } from './DeleteSessionOverlay';
import { WorkspaceLauncher } from '../../../features/workspace/components/WorkspaceLauncher';
import type { SettingsScopeChange } from '../../../features/settings/settingsFocus';
import type { ImpactScope } from '../../../features/impact/lib';
import { OnboardingWizard } from '../../../features/onboarding/OnboardingWizard';
import { useIsMainWindow } from '../../../features/workspace/useIsMainWindow';
import type { InboxStudioFocus, StudioPlace } from '../../../store';
import type { ChangelogScreen } from '../../../features/changelog/changelogScreens';
import { StudioFrame } from '../StudioFrame';
import type { StudioPlacement } from '../StudioFrame/studioPlacement';
import { isAppScopeOverlay } from '../../hooks/useAppOverlays/overlayState';
import type { PaletteRequest } from '../../../features/palette/paletteModeTypes';
import { AppScopeOverlays } from './AppScopeOverlays';

const SettingsStudio = lazy(() =>
  import('../../../features/settings/components/SettingsStudio').then((module) => ({
    default: module.SettingsStudio,
  })),
);
const GuideStudio = lazy(() =>
  import('../../../features/settings/components/GuideStudio').then((module) => ({
    default: module.GuideStudio,
  })),
);
const WorkspaceLinkStudio = lazy(() =>
  import('../../../features/workspace/components/WorkspaceLinkStudio').then((module) => ({
    default: module.WorkspaceLinkStudio,
  })),
);
const WorkflowStudio = lazy(() =>
  import('../../../features/workflows/components/WorkflowStudio').then((module) => ({
    default: module.WorkflowStudio,
  })),
);
const InboxStudio = lazy(() =>
  import('../../../features/inbox/components/InboxStudio').then((module) => ({
    default: module.InboxStudio,
  })),
);
const ImpactStudio = lazy(() =>
  import('../../../features/impact/components/ImpactStudio').then((module) => ({
    default: module.ImpactStudio,
  })),
);
const ChangelogStudio = lazy(() =>
  import('../../../features/changelog/components/ChangelogStudio').then((module) => ({
    default: module.ChangelogStudio,
  })),
);
const NotificationsStudio = lazy(() =>
  import('../../../features/notifications/components/NotificationsStudio').then((module) => ({
    default: module.NotificationsStudio,
  })),
);
const ChatStudio = lazy(() =>
  import('../../../features/workspace-chat/components/ChatStudio').then((module) => ({
    default: module.ChatStudio,
  })),
);
const TerminalStudio = lazy(() =>
  import('../../../features/terminal/components/TerminalStudio').then((module) => ({
    default: module.TerminalStudio,
  })),
);
const MonitoringStudio = lazy(() =>
  import('../../../features/monitoring/components/MonitoringStudio').then((module) => ({
    default: module.MonitoringStudio,
  })),
);

type Props = {
  readonly overlay: StudioPlace | null;
  readonly close: () => void;
  readonly onSettingsScopeChange: (params: SettingsScopeChange) => void;
  readonly onInboxFocusChange: (focus: InboxStudioFocus) => void;
  readonly onImpactScopeChange: (scope: ImpactScope) => void;
  readonly onOpenChangelogScreen: (params: { readonly screen: ChangelogScreen }) => void;
  readonly currentWorkspace: Workspace | null;
  readonly isWorkspaceLauncherBranch: boolean;
  readonly deleteOpen: boolean;
  readonly deleteTargetSession: Session | null;
  readonly palette: PaletteRequest | null;
  readonly closePalette: () => void;
  readonly closeDeleteConfirm: () => void;
};

type StudioParams = {
  readonly overlay: StudioPlace;
  readonly close: () => void;
  readonly onSettingsScopeChange: (params: SettingsScopeChange) => void;
  readonly onInboxFocusChange: (focus: InboxStudioFocus) => void;
  readonly onImpactScopeChange: (scope: ImpactScope) => void;
  readonly onOpenChangelogScreen: (params: { readonly screen: ChangelogScreen }) => void;
  readonly currentWorkspace: Workspace | null;
  readonly workspaceProjectRoot: string | null;
  readonly placement?: StudioPlacement;
  readonly settingsColumnSlot?: HTMLElement | null;
};

type RenderParams = Omit<StudioParams, 'placement'> & {
  readonly isInColumnShell: boolean;
};

const renderStudio = ({
  overlay,
  close,
  onSettingsScopeChange,
  onInboxFocusChange,
  onImpactScopeChange,
  onOpenChangelogScreen,
  currentWorkspace,
  workspaceProjectRoot,
  settingsColumnSlot = null,
  isInColumnShell,
}: RenderParams): ReactNode => {
  switch (overlay.kind) {
    case 'settings':
      return (
        <SettingsStudio
          currentWorkspace={currentWorkspace}
          focus={overlay.focus}
          onScopeChange={onSettingsScopeChange}
          onClose={close}
          columnSlot={settingsColumnSlot}
          isInColumnShell={isInColumnShell}
        />
      );
    case 'guide':
      return <GuideStudio onClose={close} />;
    case 'addWorkspace':
      return <WorkspaceLinkStudio onClose={close} />;
    case 'workflow':
      return currentWorkspace === null ? null : (
        <WorkflowStudio workspaceId={currentWorkspace.id} onClose={close} />
      );
    case 'inbox':
      return currentWorkspace === null ? null : (
        <InboxStudio
          workspaceId={currentWorkspace.id}
          rootPath={workspaceProjectRoot ?? ''}
          initialProvider={overlay.focus?.provider ?? null}
          initialKind={overlay.focus?.kind ?? null}
          initialRecordKey={overlay.focus?.recordKey ?? null}
          initialSessionId={overlay.focus?.sessionId ?? null}
          onFocusChange={onInboxFocusChange}
          onClose={close}
        />
      );
    case 'impact':
      return currentWorkspace === null ? null : (
        <ImpactStudio
          workspaceId={currentWorkspace.id}
          initialScope={overlay.scope ?? undefined}
          onScopeChange={onImpactScopeChange}
          onClose={close}
        />
      );
    case 'changelog':
      return currentWorkspace === null ? null : (
        <ChangelogStudio onClose={close} onOpenScreen={onOpenChangelogScreen} />
      );
    case 'notifications':
      return currentWorkspace === null ? null : <NotificationsStudio onClose={close} />;
    case 'chat':
      return currentWorkspace === null ? null : (
        <ChatStudio workspaceId={currentWorkspace.id} chatId={overlay.chatId} onClose={close} />
      );
    case 'terminal':
      return currentWorkspace === null ? null : (
        <TerminalStudio
          workspaceId={currentWorkspace.id}
          terminalId={overlay.terminalId}
          sessionId={overlay.sessionId}
          worktree={overlay.worktree ?? null}
          onClose={close}
        />
      );
    case 'monitoring':
      return currentWorkspace === null ? null : <MonitoringStudio onClose={close} />;
    default: {
      const unreachable: never = overlay;
      return unreachable;
    }
  }
};

export const AppStudio = ({
  overlay,
  close,
  onSettingsScopeChange,
  onInboxFocusChange,
  onImpactScopeChange,
  onOpenChangelogScreen,
  currentWorkspace,
  workspaceProjectRoot,
  placement = 'cover',
  settingsColumnSlot = null,
}: Omit<StudioParams, 'overlay'> & { readonly overlay: StudioPlace | null }) => {
  if (overlay === null) {
    return null;
  }
  const isInColumnShell = placement === 'content';
  const isColumnSettings = overlay.kind === 'settings' && isInColumnShell;
  return (
    <StudioFrame
      kind={overlay.kind}
      onClose={close}
      placement={placement}
      isClosable={!isColumnSettings}
      hasBand={!isColumnSettings}
    >
      {renderStudio({
        overlay,
        close,
        onSettingsScopeChange,
        onInboxFocusChange,
        onImpactScopeChange,
        onOpenChangelogScreen,
        currentWorkspace,
        workspaceProjectRoot,
        settingsColumnSlot,
        isInColumnShell,
      })}
    </StudioFrame>
  );
};

export const AppOverlayRouter = ({
  overlay,
  close,
  onSettingsScopeChange,
  onInboxFocusChange,
  onImpactScopeChange,
  onOpenChangelogScreen,
  currentWorkspace,
  isWorkspaceLauncherBranch,
  deleteOpen,
  deleteTargetSession,
  palette,
  closePalette,
  closeDeleteConfirm,
}: Props) => {
  const isInMainWindow = useIsMainWindow();
  if (isWorkspaceLauncherBranch) {
    const launcherStudio =
      overlay !== null && isAppScopeOverlay({ overlay }) ? (
        <AppStudio
          overlay={overlay}
          close={close}
          onSettingsScopeChange={onSettingsScopeChange}
          onInboxFocusChange={onInboxFocusChange}
          onImpactScopeChange={onImpactScopeChange}
          onOpenChangelogScreen={onOpenChangelogScreen}
          currentWorkspace={currentWorkspace}
          workspaceProjectRoot={null}
        />
      ) : null;
    return (
      <Suspense fallback={null}>
        <WorkspaceLauncher isCreating={overlay?.kind === 'addWorkspace'} onCloseCreate={close} />
        <AppScopeOverlays studio={launcherStudio} palette={palette} closePalette={closePalette} />
        <OnboardingWizard isMainWindow={isInMainWindow} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={null}>
      <AppScopeOverlays studio={null} palette={palette} closePalette={closePalette} />
      {deleteTargetSession !== null ? (
        <DeleteSessionOverlay
          session={deleteTargetSession}
          isOpen={deleteOpen}
          onClose={closeDeleteConfirm}
        />
      ) : null}
      <OnboardingWizard isMainWindow={isInMainWindow} />
    </Suspense>
  );
};
