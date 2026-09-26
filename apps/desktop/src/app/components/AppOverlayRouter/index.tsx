import { Suspense, lazy, type ReactNode } from 'react';
import type { Session, Workspace } from '@goodboy/types';
import { DeleteSessionConfirm } from '../../../features/session/components/DeleteSessionConfirm';
import { ConvertWorkspaceDialog } from '../../../features/workspace/components/ConvertWorkspaceDialog';
import { WorkspaceLauncher } from '../../../features/workspace/components/WorkspaceLauncher';
import type { SettingsScopeChange } from '../../../features/settings/components/SettingsStudio/types';
import { OnboardingWizard } from '../../../features/onboarding/OnboardingWizard';
import type { ChangelogScreen } from '../../../features/changelog/changelogScreens';
import { isAppScopeOverlay, type Overlay } from '../../hooks/useAppOverlays/overlayState';
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
const ReportIssueStudio = lazy(() =>
  import('../../../features/settings/components/ReportIssueStudio').then((module) => ({
    default: module.ReportIssueStudio,
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
const CompanionStudio = lazy(() =>
  import('../../../features/companion/components/CompanionStudio').then((module) => ({
    default: module.CompanionStudio,
  })),
);

type Props = {
  readonly overlay: Overlay | null;
  readonly close: () => void;
  readonly onSettingsScopeChange: (params: SettingsScopeChange) => void;
  readonly onOpenChangelogScreen: (params: { readonly screen: ChangelogScreen }) => void;
  readonly currentWorkspace: Workspace | null;
  readonly isWorkspaceLauncherBranch: boolean;
  readonly deleteOpen: boolean;
  readonly deleteTargetSession: Session | null;
  readonly paletteOpen: boolean;
  readonly palettePrefix: string;
  readonly convertWorkspaceOpen: boolean;
  readonly closePalette: () => void;
  readonly offerWorkspaceRepo: () => void;
  readonly closeConvertWorkspace: () => void;
  readonly closeDeleteConfirm: () => void;
};

type StudioParams = {
  readonly overlay: Overlay;
  readonly close: () => void;
  readonly onSettingsScopeChange: (params: SettingsScopeChange) => void;
  readonly onOpenChangelogScreen: (params: { readonly screen: ChangelogScreen }) => void;
  readonly currentWorkspace: Workspace | null;
  readonly workspaceProjectRoot: string | null;
  readonly offerWorkspaceRepo: () => void;
};

const renderStudio = ({
  overlay,
  close,
  onSettingsScopeChange,
  onOpenChangelogScreen,
  currentWorkspace,
  workspaceProjectRoot,
  offerWorkspaceRepo,
}: StudioParams): ReactNode => {
  switch (overlay.kind) {
    case 'settings':
      return (
        <SettingsStudio
          currentWorkspace={currentWorkspace}
          focus={overlay.focus}
          onScopeChange={onSettingsScopeChange}
          onClose={close}
        />
      );
    case 'guide':
      return <GuideStudio onClose={close} />;
    case 'report':
      return <ReportIssueStudio onClose={close} />;
    case 'companion':
      return <CompanionStudio onClose={close} />;
    case 'addWorkspace':
      return (
        <WorkspaceLinkStudio
          variant="fullscreen"
          onClose={close}
          onOfferRepo={offerWorkspaceRepo}
        />
      );
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
          onClose={close}
        />
      );
    case 'impact':
      return currentWorkspace === null ? null : (
        <ImpactStudio
          workspaceId={currentWorkspace.id}
          initialScope={overlay.scope ?? undefined}
          onClose={close}
        />
      );
    case 'changelog':
      return currentWorkspace === null ? null : (
        <ChangelogStudio onClose={close} onOpenScreen={onOpenChangelogScreen} />
      );
    case 'notifications':
      return currentWorkspace === null ? null : <NotificationsStudio onClose={close} />;
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
  onOpenChangelogScreen,
  currentWorkspace,
  workspaceProjectRoot,
  offerWorkspaceRepo,
}: Omit<StudioParams, 'overlay'> & { readonly overlay: Overlay | null }) => {
  if (overlay === null) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      {renderStudio({
        overlay,
        close,
        onSettingsScopeChange,
        onOpenChangelogScreen,
        currentWorkspace,
        workspaceProjectRoot,
        offerWorkspaceRepo,
      })}
    </Suspense>
  );
};

export const AppOverlayRouter = ({
  overlay,
  close,
  onSettingsScopeChange,
  onOpenChangelogScreen,
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
}: Props) => {
  if (isWorkspaceLauncherBranch) {
    const launcherStudio =
      overlay !== null && isAppScopeOverlay({ overlay }) ? (
        <AppStudio
          overlay={overlay}
          close={close}
          onSettingsScopeChange={onSettingsScopeChange}
          onOpenChangelogScreen={onOpenChangelogScreen}
          currentWorkspace={currentWorkspace}
          workspaceProjectRoot={null}
          offerWorkspaceRepo={offerWorkspaceRepo}
        />
      ) : null;
    return (
      <Suspense fallback={null}>
        {overlay?.kind === 'addWorkspace' ? (
          <WorkspaceLinkStudio
            variant="viewport"
            onClose={close}
            onOfferRepo={offerWorkspaceRepo}
          />
        ) : (
          <WorkspaceLauncher />
        )}
        <AppScopeOverlays
          studio={launcherStudio}
          paletteOpen={paletteOpen}
          palettePrefix={palettePrefix}
          closePalette={closePalette}
        />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={null}>
      <AppScopeOverlays
        studio={null}
        paletteOpen={paletteOpen}
        palettePrefix={palettePrefix}
        closePalette={closePalette}
      />
      {currentWorkspace !== null ? (
        <ConvertWorkspaceDialog
          open={convertWorkspaceOpen}
          workspace={currentWorkspace}
          onClose={closeConvertWorkspace}
        />
      ) : null}
      {deleteTargetSession !== null && deleteOpen ? (
        <div className="fixed bottom-4 right-4 z-popover w-96 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-floating shadow-lg">
          <DeleteSessionConfirm session={deleteTargetSession} onClose={closeDeleteConfirm} />
        </div>
      ) : null}
      <OnboardingWizard />
    </Suspense>
  );
};
