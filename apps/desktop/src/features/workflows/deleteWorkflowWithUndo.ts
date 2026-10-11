import type { Workflow, WorkflowId, WorkspaceId } from '@goodboy/types';
import type { ShowToast } from '../../shared/components/Toast';
import { undoable } from '../../shared/utils/undoable';

type RestoreParams = {
  readonly workspaceId: WorkspaceId;
  readonly snapshot: Workflow;
};

type Params = {
  readonly workflow: Workflow;
  readonly workspaceId: WorkspaceId;
  readonly showToast: ShowToast;
  readonly deleteWorkflow: (id: WorkflowId, workspaceId: WorkspaceId) => Promise<void>;
  readonly restoreWorkflowSnapshot: (params: RestoreParams) => Promise<boolean>;
};

export const deleteWorkflowWithUndo = async ({
  workflow,
  workspaceId,
  showToast,
  deleteWorkflow,
  restoreWorkflowSnapshot,
}: Params): Promise<void> => {
  await deleteWorkflow(workflow.id, workspaceId);
  undoable({
    showToast,
    message: `Deleted ${workflow.name}`,
    undo: () => restoreWorkflowSnapshot({ workspaceId, snapshot: workflow }),
  });
};
