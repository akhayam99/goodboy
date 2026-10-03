import { cn, PANE_RHYTHM, ScrollFade } from '@goodboy/ui';
import type { Workspace } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { isWizardDone, reopenWizard } from '../../../onboarding/onboarding-store';
import { useAppStore } from '../../../../store';
import { WorkspaceLinkForm, type WorkspaceLinkMode } from '../WorkspaceLinkForm';
import { NewProjectForm } from '../../../../shared/components/NewProjectForm';

type Props = {
  readonly variant: 'fullscreen' | 'viewport';
  readonly onClose: () => void;
  readonly onOfferRepo: () => void;
  readonly isNewProject?: boolean;
};

type CompleteParams = {
  readonly mode: WorkspaceLinkMode;
  readonly workspace: Workspace;
  readonly requestClose: () => void;
};

export const WorkspaceLinkStudio = ({
  variant,
  onClose,
  onOfferRepo,
  isNewProject = false,
}: Props) => {
  const onComplete = ({ mode, workspace, requestClose }: CompleteParams) => {
    requestClose();
    if (!isWizardDone()) {
      reopenWizard('setup');
      return;
    }
    if (mode !== 'project') {
      return;
    }
    const project = useAppStore
      .getState()
      .projects.find((candidate) => candidate.workspaceId === workspace.id);
    if (project?.kind === 'folder') {
      onOfferRepo();
    }
  };

  return (
    <StudioShell
      icon={CONCEPT_ICONS.workspace}
      tone={CONCEPT_TONE.workspace}
      title={isNewProject ? 'Start a new project' : 'Add workspace'}
      subtitle={
        isNewProject
          ? 'A new folder with git on main, and a first session that works in it.'
          : 'Open a folder as a workspace, or group several projects in one.'
      }
      closeLabel={isNewProject ? 'close start a new project' : 'close add workspace'}
      variant={variant}
      onClose={onClose}
    >
      {(requestClose) => (
        <ScrollFade className="min-h-0 flex-1" viewportClassName={PANE_RHYTHM.body} fadeSize={24}>
          <div className={cn(PANE_RHYTHM.column, 'flex flex-col gap-6')}>
            {isNewProject ? (
              <NewProjectForm onCreated={requestClose} onCancel={requestClose} />
            ) : (
              <WorkspaceLinkForm
                onComplete={({ mode, workspace }) => onComplete({ mode, workspace, requestClose })}
              />
            )}
          </div>
        </ScrollFade>
      )}
    </StudioShell>
  );
};
