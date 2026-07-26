import type { WorkspaceId } from '@goodboy/types';
import { WorkflowsPanel } from '../WorkflowsPanel';
import { SECTION_ICONS } from '../../../../shared/components/section-icons';
import { StudioShell } from '../../../../shared/components/StudioShell';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly workspaceName: string;
  readonly onClose: () => void;
};

export const WorkflowStudio = ({ workspaceId, workspaceName, onClose }: Props) => {
  return (
    <StudioShell
      icon={SECTION_ICONS.workflows}
      title="Workflow Studio"
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
