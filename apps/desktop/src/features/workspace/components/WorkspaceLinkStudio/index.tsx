import { PANE_RHYTHM, ScrollFade } from '@goodboy/ui';
import type { Workspace } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { isWizardDone, reopenWizard } from '../../../onboarding/onboarding-store';
import { useAppStore } from '../../../../store';
import { WorkspaceLinkForm, type WorkspaceLinkMode } from '../WorkspaceLinkForm';

type Props = {
  readonly variant: 'fullscreen' | 'viewport';
  readonly onClose: () => void;
  readonly onOfferRepo: () => void;
};

type CompleteParams = {
  readonly mode: WorkspaceLinkMode;
  readonly workspace: Workspace;
  readonly requestClose: () => void;
};

export const WorkspaceLinkStudio = ({ variant, onClose, onOfferRepo }: Props) => {
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
      title="Add workspace"
      workspaceName="Create a workspace, then add the projects it works on."
      closeLabel="close add workspace"
      variant={variant}
      onClose={onClose}
    >
      {(requestClose) => (
        <ScrollFade className="min-h-0 flex-1" viewportClassName={PANE_RHYTHM.body} fadeSize={24}>
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
            <WorkspaceLinkForm
              onComplete={({ mode, workspace }) => onComplete({ mode, workspace, requestClose })}
            />
          </div>
        </ScrollFade>
      )}
    </StudioShell>
  );
};
