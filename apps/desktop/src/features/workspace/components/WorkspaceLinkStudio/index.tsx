import { PageColumn, ScrollFade } from '@goodboy/ui';
import type { WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { NewWorkspaceForm } from '../../../../shared/components/NewWorkspaceForm';
import { useAppStore } from '../../../../store';
import { NAMES } from '../../../../shared/names';
import { hasOnlyPlainFolders } from '../../hasOnlyPlainFolders';

type Props = {
  readonly onClose: () => void;
  readonly onOfferRepo: () => void;
};

type CreatedParams = {
  readonly workspaceId: WorkspaceId;
  readonly requestClose: () => void;
};

export const WorkspaceLinkStudio = ({ onClose, onOfferRepo }: Props) => {
  const onCreated = ({ workspaceId, requestClose }: CreatedParams) => {
    requestClose();
    if (hasOnlyPlainFolders({ projects: useAppStore.getState().projects, workspaceId })) {
      onOfferRepo();
    }
  };

  return (
    <StudioShell
      icon={CONCEPT_ICONS.workspace}
      tone={CONCEPT_TONE.workspace}
      title={NAMES.newWorkspace}
      onClose={onClose}
    >
      {(requestClose) => (
        <ScrollFade className="min-h-0 flex-1" fadeSize={24}>
          <PageColumn className="flex flex-col gap-6 py-5">
            <NewWorkspaceForm
              mode="new"
              titleRole="title"
              onCreated={({ workspaceId }) => onCreated({ workspaceId, requestClose })}
            />
          </PageColumn>
        </ScrollFade>
      )}
    </StudioShell>
  );
};
