import { useEffect } from 'react';
import type { OrchestratorHint, SessionId, WorkflowRunId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';

type Params = {
  readonly sessionId: SessionId;
  readonly runId: WorkflowRunId;
  readonly hint: OrchestratorHint;
};

export const useHintImageItems = ({ sessionId, runId, hint }: Params) => {
  const loadGoalAttachments = useAppStore((state) => state.loadGoalAttachments);
  const attachments = useAppStore((state) => state.workflowRunAttachments[runId] ?? EMPTY_ARRAY);
  const workingDir = useAppStore((state) => state.sessionWorktrees[sessionId]?.[0] ?? null);
  const ids = hint.attachmentIds ?? EMPTY_ARRAY;
  const hasImages = ids.length > 0;

  useEffect(() => {
    if (!hasImages) {
      return;
    }
    void loadGoalAttachments({ type: 'workflow_run', id: runId });
  }, [hasImages, runId, loadGoalAttachments]);

  return attachments
    .filter((attachment) => attachment.kind === 'image' && ids.includes(attachment.id))
    .map((attachment) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      kind: attachment.kind,
      relPath: attachment.relPath,
      workingDir,
    }));
};
