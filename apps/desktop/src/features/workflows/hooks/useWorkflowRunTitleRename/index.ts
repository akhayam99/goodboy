import type { SessionId, WorkflowRunId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { useInlineRename } from '../../../../shared/hooks/useInlineRename';
import { MAX_WORKFLOW_TITLE_LENGTH } from '../../../../store/slices/workflows/titleLimit';

type Params = {
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly currentTitle: string;
};

export const useWorkflowRunTitleRename = ({ sessionId, workflowRunId, currentTitle }: Params) => {
  const renameWorkflowRun = useAppStore((s) => s.renameWorkflowRun);

  return useInlineRename({
    value: currentTitle,
    maxLength: MAX_WORKFLOW_TITLE_LENGTH,
    onCommit: (next) => renameWorkflowRun(sessionId, workflowRunId, next),
  });
};
