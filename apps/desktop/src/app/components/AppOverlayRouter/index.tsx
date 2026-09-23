import { Suspense, lazy, type ReactNode } from 'react';
import type { Session, Workspace } from '@goodboy/types';
import { CommandPalette } from '../../../features/session/components/CommandPalette';
import { DeleteSessionConfirm } from '../../../features/session/components/DeleteSessionConfirm';
import { ConvertWorkspaceDialog } from '../../../features/workspace/components/ConvertWorkspaceDialog';
import { WorkspaceLauncher } from '../../../features/workspace/components/WorkspaceLauncher';
import type { SettingsStudioScope } from '../../../features/settings/components/SettingsStudio/types';
import { OnboardingWizard } from '../../../features/onboarding/OnboardingWizard';
import type { CommitDiffTarget } from '../../../shared/hooks/useCommitLinkInterceptor';
import type { Overlay } from '../../hooks/useAppOverlays/overlayState';

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
const DiffViewerDialog = lazy(() =>
  import('../../../features/permissions/components/DiffViewerDialog').then((module) => ({
    default: module.DiffViewerDialog,
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
  readonly currentWorkspace: Workspace | null;
  readonly isWorkspaceLauncherBranch: boolean;
  readonly deleteOpen: boolean;
  readonly deleteTargetSession: Session | null;
  readonly paletteOpen: boolean;
  readonly palettePrefix: string;
  readonly convertWorkspaceOpen: boolean;
  readonly commitDiff: CommitDiffTarget | null;
  readonly commitDiffLoader: () => Promise<string>;
  readonly closePalette: () => void;
  readonly offerWorkspaceRepo: () => void;
  readonly closeConvertWorkspace: () => void;
  readonly closeCommitDiff: () => void;
  readonly closeDeleteConfirm: () => void;
};

type StudioParams = {
  readonly overlay: Overlay;
  readonly close: () => void;
  readonly onSettingsScopeChange: (params: { readonly scope: SettingsStudioScope }) => void;
  readonly currentWorkspace: Workspace | null;
  readonly workspaceProjectRoot: string | null;
  readonly offerWorkspaceRepo: () => void;
};

const renderStudio = ({
  overlay,
  close,
  onSettingsScopeChange,
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
        <WorkflowStudio
          workspaceId={currentWorkspace.id}
          workspaceName={currentWorkspace.name}
          onClose={close}
        />
      );
    case 'inbox':
      return currentWorkspace === null ? null : (
        <InboxStudio
          workspaceId={currentWorkspace.id}
          rootPath={workspaceProjectRoot ?? ''}
          workspaceName={currentWorkspace.name}
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
          workspaceName={currentWorkspace.name}
          initialScope={overlay.scope ?? undefined}
          onClose={close}
        />
      );
    case 'changelog':
      return currentWorkspace === null ? null : (
        <ChangelogStudio workspaceName={currentWorkspace.name} onClose={close} />
      );
    case 'notifications':
      return currentWorkspace === null ? null : (
        <NotificationsStudio workspaceName={currentWorkspace.name} onClose={close} />
      );
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
  currentWorkspace,
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
}: Props) => {
  if (isWorkspaceLauncherBranch) {
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
      </Suspense>
    );
  }

  return (
    <Suspense fallback={null}>
      {paletteOpen ? <CommandPalette initialQuery={palettePrefix} onClose={closePalette} /> : null}
      {currentWorkspace !== null ? (
        <ConvertWorkspaceDialog
          open={convertWorkspaceOpen}
          workspace={currentWorkspace}
          onClose={closeConvertWorkspace}
        />
      ) : null}
      {commitDiff !== null ? (
        <DiffViewerDialog
          open
          onClose={closeCommitDiff}
          title={`Commit ${commitDiff.sha.slice(0, 7)}`}
          loader={commitDiffLoader}
        />
      ) : null}
      {deleteTargetSession !== null && deleteOpen ? (
        <div className="fixed bottom-4 right-4 z-popover w-96 max-w-[calc(100vw-2rem)] rounded-lg bg-background shadow-lg">
          <DeleteSessionConfirm session={deleteTargetSession} onClose={closeDeleteConfirm} />
        </div>
      ) : null}
      <OnboardingWizard />
    </Suspense>
  );
};
