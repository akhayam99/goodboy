import type { WorkflowId, WorkspaceId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useInlineRename } from '../../../../shared/hooks/useInlineRename';
import { MAX_WORKFLOW_TITLE_LENGTH } from '../../../../store/slices/workflows/titleLimit';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly workflowId: WorkflowId;
  readonly currentTitle: string;
};

export const useWorkflowTitleRename = ({ workspaceId, workflowId, currentTitle }: Params) => {
  const renameWorkflow = useAppStore((s) => s.renameWorkflow);

  return useInlineRename({
    value: currentTitle,
    maxLength: MAX_WORKFLOW_TITLE_LENGTH,
    onCommit: (next) => renameWorkflow(workspaceId, workflowId, next),
  });
};
