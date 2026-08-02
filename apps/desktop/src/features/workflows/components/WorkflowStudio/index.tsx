import type { WorkspaceId } from '@goodboy/types';
import { WorkflowsPanel } from '../WorkflowsPanel';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../shared/components/StudioShell';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly workspaceName: string;
  readonly onClose: () => void;
};

export const WorkflowStudio = ({ workspaceId, workspaceName, onClose }: Props) => {
  return (
    <StudioShell
      icon={CONCEPT_ICONS.workflows}
      tone={CONCEPT_TONE.workflows}
      title="Workflow studio"
      workspaceName={workspaceName}
      closeLabel="close workflow studio"
      onClose={onClose}
    >
      {() => (
        <div className="min-h-0 min-w-0 flex-1">
          <WorkflowsPanel workspaceId={workspaceId} />
        </div>
      )}
    </StudioShell>
  );
};
