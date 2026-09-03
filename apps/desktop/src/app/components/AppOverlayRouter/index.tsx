import type {
  ProviderId,
  ProviderLifecycleAction,
  Session,
  SessionId,
  Workspace,
} from '@goodboy/types';
import type { InboxKind, InboxProvider } from '../../../features/inbox/types';
import { ArchiveSessionConfirm } from '../../../features/session/components/ArchiveSessionConfirm';
import { CommandPalette } from '../../../features/session/components/CommandPalette';
import { DeleteSessionConfirm } from '../../../features/session/components/DeleteSessionConfirm';
import { SettingsStudio } from '../../../features/settings/components/SettingsStudio';
import { GuideStudio } from '../../../features/settings/components/GuideStudio';
import { ReportIssueStudio } from '../../../features/settings/components/ReportIssueStudio';
import { WorkspaceLinkStudio } from '../../../features/workspace/components/WorkspaceLinkStudio';
import { ConvertWorkspaceDialog } from '../../../features/workspace/components/ConvertWorkspaceDialog';
import { WorkspaceLauncher } from '../../../features/workspace/components/WorkspaceLauncher';
import { WorkflowStudio } from '../../../features/workflows/components/WorkflowStudio';
import { InboxStudio } from '../../../features/inbox/components/InboxStudio';
import { ProviderStudio } from '../../../features/providers/components/ProviderStudio';
import { BudgetStudio } from '../../../features/budget/components/BudgetStudio';
import type { BudgetScope } from '../../../features/budget/components/BudgetStudio/lib';
import { ImpactStudio } from '../../../features/impact/components/ImpactStudio';
import { ChangelogStudio } from '../../../features/changelog/components/ChangelogStudio';
import { NotificationsStudio } from '../../../features/notifications/components/NotificationsStudio';
import { DiffViewerDialog } from '../../../features/permissions/components/DiffViewerDialog';
import { OnboardingWizard } from '../../../features/onboarding/OnboardingWizard';
import { CompanionStudio } from '../../../features/companion/CompanionStudio';
import type { CommitDiffTarget } from '../../../shared/hooks/useCommitLinkInterceptor';

type Props = {
  readonly currentWorkspace: Workspace | null;
  readonly workspaceProjectRoot: string | null;
  readonly isWorkspaceLauncherBranch: boolean;
  readonly companionOpen: boolean;
  readonly appSettingsOpen: boolean;
  readonly appSettingsFocus: string | undefined;
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
  } | null;
  readonly providerStudioOpen: boolean;
  readonly providerStudioFocus: ProviderId | null;
  readonly providerStudioAction: ProviderLifecycleAction | null;
  readonly budgetStudioOpen: boolean;
  readonly budgetStudioScope: BudgetScope | undefined;
  readonly impactStudioOpen: boolean;
  readonly changelogStudioOpen: boolean;
  readonly notificationsStudioOpen: boolean;
  readonly commitDiff: CommitDiffTarget | null;
  readonly commitDiffLoader: () => Promise<string>;
  readonly closeAppSettings: () => void;
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
  readonly closeProviderStudio: () => void;
  readonly closeBudgetStudio: () => void;
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
  inboxStudioOpen,
  inboxStudioFocus,
  providerStudioOpen,
  providerStudioFocus,
  providerStudioAction,
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
  closeProviderStudio,
  closeBudgetStudio,
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
    return addWorkspaceSurface ?? <WorkspaceLauncher />;
  }

  return (
    <>
      {appSettingsOpen ? (
        <SettingsStudio initialFocus={appSettingsFocus} onClose={closeAppSettings} />
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
      {providerStudioOpen && currentWorkspace !== null ? (
        <ProviderStudio
          workspaceId={currentWorkspace.id}
          workspaceName={currentWorkspace.name}
          initialFocus={providerStudioFocus}
          initialAction={providerStudioAction}
          onClose={closeProviderStudio}
        />
      ) : null}
      {budgetStudioOpen && currentWorkspace !== null ? (
        <BudgetStudio
          workspaceName={currentWorkspace.name}
          initialScope={budgetStudioScope}
          onClose={closeBudgetStudio}
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
    </>
  );
};
