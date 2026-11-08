import { PaneShell } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { NewWorkspaceForm } from '../../../../shared/components/NewWorkspaceForm';
import { copyOf } from '../../../../shared/components/NewWorkspaceForm/newWorkspaceCopy';
import { NAMES } from '../../../../shared/utils/names';

type Props = {
  readonly onClose: () => void;
};

const COPY = copyOf({ mode: 'new', targetName: '' });

export const WorkspaceLinkStudio = ({ onClose }: Props) => {
  return (
    <StudioShell
      icon={CONCEPT_ICONS.workspace}
      tone={CONCEPT_TONE.workspace}
      title={NAMES.newWorkspace}
      onClose={onClose}
    >
      {(requestClose) => (
        <PaneShell
          title={COPY.title}
          subheader={<p className="text-prose text-muted-foreground">{COPY.lede}</p>}
        >
          <NewWorkspaceForm mode="new" hasTitle={false} onCreated={() => requestClose()} />
        </PaneShell>
      )}
    </StudioShell>
  );
};
