import { PageColumn, ScrollFade } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { NewWorkspaceForm } from '../../../../shared/components/NewWorkspaceForm';
import { useAppStore } from '../../../../store';

type Props = {
  readonly variant: 'fullscreen' | 'viewport';
  readonly onClose: () => void;
  readonly onOfferRepo: () => void;
  readonly isNewProject?: boolean;
};

type CreatedParams = {
  readonly workspaceId: WorkspaceId;
  readonly requestClose: () => void;
};

export const WorkspaceLinkStudio = ({
  variant,
  onClose,
  onOfferRepo,
  isNewProject = false,
}: Props) => {
  const onCreated = ({ workspaceId, requestClose }: CreatedParams) => {
    requestClose();
    const folders = useAppStore
      .getState()
      .projects.filter((project) => project.workspaceId === workspaceId);
    if (folders.length > 0 && folders.every((project) => project.kind === 'folder')) {
      onOfferRepo();
    }
  };

  return (
    <StudioShell
      icon={CONCEPT_ICONS.workspace}
      tone={CONCEPT_TONE.workspace}
      title="New workspace"
      variant={variant}
      onClose={onClose}
    >
      {(requestClose) => (
        <ScrollFade className="min-h-0 flex-1" fadeSize={24}>
          <PageColumn className="flex flex-col gap-6 py-5">
            <NewWorkspaceForm
              mode="new"
              start={isNewProject ? 'scratch' : 'folder'}
              titleRole="title"
              onCreated={({ workspaceId }) => onCreated({ workspaceId, requestClose })}
            />
          </PageColumn>
        </ScrollFade>
      )}
    </StudioShell>
  );
};
