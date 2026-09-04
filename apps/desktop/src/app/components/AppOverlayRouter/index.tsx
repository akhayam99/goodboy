import { Suspense, lazy } from 'react';
import type { Session, SessionId, Workspace } from '@goodboy/types';
import type { InboxKind, InboxProvider } from '../../../features/inbox/types';
import { ArchiveSessionConfirm } from '../../../features/session/components/ArchiveSessionConfirm';
import { CommandPalette } from '../../../features/session/components/CommandPalette';
import { DeleteSessionConfirm } from '../../../features/session/components/DeleteSessionConfirm';
import { ConvertWorkspaceDialog } from '../../../features/workspace/components/ConvertWorkspaceDialog';
import { WorkspaceLauncher } from '../../../features/workspace/components/WorkspaceLauncher';
import type { SettingsFocus } from '../../../features/settings/components/SettingsStudio/types';
import { OnboardingWizard } from '../../../features/onboarding/OnboardingWizard';
import type { CommitDiffTarget } from '../../../shared/hooks/useCommitLinkInterceptor';

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
  import('../../../features/companion/CompanionStudio').then((module) => ({
    default: module.CompanionStudio,
  })),
);

type Props = {
  readonly currentWorkspace: Workspace | null;
  readonly workspaceProjectRoot: string | null;
  readonly isWorkspaceLauncherBranch: boolean;
  readonly companionOpen: boolean;
  readonly settingsOpen: boolean;
  readonly settingsFocus: SettingsFocus;
  readonly guideStudioOpen: boolean;
  readonly reportIssueStudioOpen: boolean;
  readonly deleteOpen: boolean;
  readonly deleteTargetSession: Session | null;
  readonly archiveOpen: boolean;
  readonly archiveTargetSession: Session | null;
  readonly paletteOpen: boolean;
  readonly palettePrefix: string;
  readonly addWorkspaceOpen: boolean;
  readonly convertWorkspaceOpen: boolean;
  readonly workflowStudioOpen: boolean;
  readonly inboxStudioOpen: boolean;
  readonly inboxStudioFocus: {
    readonly provider: InboxProvider | null;
    readonly kind: InboxKind | null;
    readonly recordKey: string | null;
    readonly sessionId: SessionId | null;
  } | null;
  readonly impactStudioOpen: boolean;
  readonly changelogStudioOpen: boolean;
  readonly notificationsStudioOpen: boolean;
  readonly commitDiff: CommitDiffTarget | null;
  readonly commitDiffLoader: () => Promise<string>;
  readonly closeSettings: () => void;
  readonly closeGuideStudio: () => void;
  readonly closeReportIssueStudio: () => void;
  readonly closePalette: () => void;
  readonly openSettingsFromPalette: () => void;
  readonly closePaletteForNewSession: () => void;
  readonly openProvidersFromPalette: () => void;
  readonly openShortcutHelpFromPalette: () => void;
  readonly closeAddWorkspace: () => void;
  readonly offerWorkspaceRepo: () => void;
  readonly closeConvertWorkspace: () => void;
  readonly closeWorkflowStudio: () => void;
  readonly closeImpactStudio: () => void;
  readonly closeChangelogStudio: () => void;
  readonly closeNotificationsStudio: () => void;
  readonly closeInboxStudio: () => void;
  readonly closeCommitDiff: () => void;
  readonly closeDeleteConfirm: () => void;
  readonly closeArchiveConfirm: () => void;
  readonly closeCompanion: () => void;
};

export const AppOverlayRouter = ({
  currentWorkspace,
  workspaceProjectRoot,
  isWorkspaceLauncherBranch,
  companionOpen,
  settingsOpen,
  settingsFocus,
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
  inboxStudioOpen,
  inboxStudioFocus,
  impactStudioOpen,
  changelogStudioOpen,
  notificationsStudioOpen,
  commitDiff,
  commitDiffLoader,
  closeSettings,
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
  closeImpactStudio,
  closeChangelogStudio,
  closeNotificationsStudio,
  closeInboxStudio,
  closeCommitDiff,
  closeDeleteConfirm,
  closeArchiveConfirm,
  closeCompanion,
}: Props) => {
  const addWorkspaceSurface = addWorkspaceOpen ? (
    <WorkspaceLinkStudio onClose={closeAddWorkspace} onOfferRepo={offerWorkspaceRepo} />
  ) : null;

  if (isWorkspaceLauncherBranch) {
    return <Suspense fallback={null}>{addWorkspaceSurface ?? <WorkspaceLauncher />}</Suspense>;
  }

  return (
    <Suspense fallback={null}>
      {settingsOpen ? (
        <SettingsStudio
          currentWorkspace={currentWorkspace}
          initialFocus={settingsFocus}
          onClose={closeSettings}
        />
      ) : null}
      {guideStudioOpen ? <GuideStudio onClose={closeGuideStudio} /> : null}
      {reportIssueStudioOpen ? <ReportIssueStudio onClose={closeReportIssueStudio} /> : null}
      {paletteOpen ? (
        <CommandPalette
          initialQuery={palettePrefix}
          onClose={closePalette}
          onOpenSettings={openSettingsFromPalette}
          onNewSession={closePaletteForNewSession}
          onOpenProviders={openProvidersFromPalette}
          onOpenShortcutHelp={openShortcutHelpFromPalette}
        />
      ) : null}
      {addWorkspaceSurface}
      {currentWorkspace !== null ? (
        <ConvertWorkspaceDialog
          open={convertWorkspaceOpen}
          workspace={currentWorkspace}
          onClose={closeConvertWorkspace}
        />
      ) : null}
      {workflowStudioOpen && currentWorkspace !== null ? (
        <WorkflowStudio
          workspaceId={currentWorkspace.id}
          workspaceName={currentWorkspace.name}
          onClose={closeWorkflowStudio}
        />
      ) : null}
      {impactStudioOpen && currentWorkspace !== null ? (
        <ImpactStudio
          workspaceId={currentWorkspace.id}
          workspaceName={currentWorkspace.name}
          onClose={closeImpactStudio}
        />
      ) : null}
      {changelogStudioOpen && currentWorkspace !== null ? (
        <ChangelogStudio workspaceName={currentWorkspace.name} onClose={closeChangelogStudio} />
      ) : null}
      {notificationsStudioOpen && currentWorkspace !== null ? (
        <NotificationsStudio
          workspaceName={currentWorkspace.name}
          onClose={closeNotificationsStudio}
        />
      ) : null}
      {inboxStudioOpen && currentWorkspace !== null ? (
        <InboxStudio
          workspaceId={currentWorkspace.id}
          rootPath={workspaceProjectRoot ?? ''}
          workspaceName={currentWorkspace.name}
          initialProvider={inboxStudioFocus?.provider ?? null}
          initialKind={inboxStudioFocus?.kind ?? null}
          initialRecordKey={inboxStudioFocus?.recordKey ?? null}
          initialSessionId={inboxStudioFocus?.sessionId ?? null}
          onClose={closeInboxStudio}
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
      {archiveTargetSession !== null && archiveOpen ? (
        <div className="fixed bottom-4 right-4 z-popover w-96 max-w-[calc(100vw-2rem)] rounded-lg bg-background shadow-lg">
          <ArchiveSessionConfirm session={archiveTargetSession} onClose={closeArchiveConfirm} />
        </div>
      ) : null}
      {companionOpen ? <CompanionStudio onClose={closeCompanion} /> : null}
      <OnboardingWizard />
    </Suspense>
  );
};
