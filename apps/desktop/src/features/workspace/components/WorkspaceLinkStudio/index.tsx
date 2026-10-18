import { PageColumn, ScrollFade } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { NewWorkspaceForm } from '../../../../shared/components/NewWorkspaceForm';
import { NAMES } from '../../../../shared/names';

type Props = {
  readonly onClose: () => void;
};

export const WorkspaceLinkStudio = ({ onClose }: Props) => {
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
            <NewWorkspaceForm mode="new" titleRole="title" onCreated={() => requestClose()} />
          </PageColumn>
        </ScrollFade>
      )}
    </StudioShell>
  );
};
