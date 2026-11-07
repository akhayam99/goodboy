import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../../../store';
import { useInlineRename } from '../../../../../../../shared/hooks/useInlineRename';
import { agentObjectKey } from '../../../../../../actions/agentObjectKey';
import { runObjectKey } from '../../../../../../actions/runObjectKey';
import { useRenameRequest } from '../../../../../../../shared/hooks/useRenameRequest';
import { MAX_WORKFLOW_TITLE_LENGTH } from '../../../../../../../store/slices/workflows/titleLimit';
import type { SessionRun } from '../../../../../sessionRunsOf';

type Params = {
  readonly sessionId: SessionId;
  readonly run: SessionRun;
  readonly anchorKey: string;
};

export const useRunRowRename = ({ sessionId, run, anchorKey }: Params) => {
  const renameWorkflowRun = useAppStore((state) => state.renameWorkflowRun);
  const renameAgent = useAppStore((state) => state.renameAgent);
  const { open } = run;
  const rename = useInlineRename({
    value: run.title,
    ...(open.kind === 'run' && { maxLength: MAX_WORKFLOW_TITLE_LENGTH }),
    onCommit:
      open.kind === 'run'
        ? renameWorkflowRun.bind(null, sessionId, open.runId)
        : renameAgent.bind(null, sessionId, open.agentId),
  });
  useRenameRequest({
    objectKey:
      open.kind === 'run'
        ? runObjectKey({ runId: open.runId })
        : agentObjectKey({ agentId: open.agentId }),
    anchorKeys: [anchorKey],
    onRename: rename.start,
  });
  return rename;
};
