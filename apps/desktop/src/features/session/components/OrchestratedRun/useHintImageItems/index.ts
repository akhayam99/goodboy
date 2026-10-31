import { useEffect, useState } from 'react';
import type { OrchestratorHint, SessionId, WorkflowRunId } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../../../../store';
import type { AttachmentStripItem } from '../../../../attachments/AttachmentStrip';
import { ORCHESTRATED_COPY } from '../../../../workflows/orchestratedCopy';

type Params = {
  readonly sessionId: SessionId;
  readonly runId: WorkflowRunId;
  readonly hint: OrchestratorHint;
};

type HintImageItems = {
  readonly images: ReadonlyArray<AttachmentStripItem>;
  readonly hasFailed: boolean;
  readonly retry: () => void;
};

export const useHintImageItems = ({ sessionId, runId, hint }: Params): HintImageItems => {
  const loadGoalAttachments = useAppStore((state) => state.loadGoalAttachments);
  const reportError = useAppStore((state) => state.reportError);
  const attachments = useAppStore((state) => state.workflowRunAttachments[runId] ?? EMPTY_ARRAY);
  const hasLoaded = useAppStore((state) => state.workflowRunAttachments[runId] !== undefined);
  const workingDir = useAppStore((state) => state.sessionWorktrees[sessionId]?.[0] ?? null);
  const [attempt, setAttempt] = useState(0);
  const [failedAttempt, setFailedAttempt] = useState<number | null>(null);
  const ids = hint.attachmentIds ?? EMPTY_ARRAY;
  const hasImages = ids.length > 0;

  useEffect(() => {
    if (!hasImages || hasLoaded) {
      return;
    }
    let isCurrent = true;
    loadGoalAttachments({ type: 'workflow_run', id: runId }).catch((error: unknown) => {
      if (!isCurrent) {
        return;
      }
      setFailedAttempt(attempt);
      void reportError({
        title: ORCHESTRATED_COPY.hintImagesLoadFailed,
        error,
        sessionId,
        coalesceKey: `hint-images:${runId}`,
      });
    });
    return () => {
      isCurrent = false;
    };
  }, [hasImages, hasLoaded, runId, sessionId, attempt, loadGoalAttachments, reportError]);

  const images = attachments
    .filter((attachment) => attachment.kind === 'image' && ids.includes(attachment.id))
    .map((attachment) => ({
      id: attachment.id,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
      kind: attachment.kind,
      relPath: attachment.relPath,
      workingDir,
    }));

  return {
    images,
    hasFailed: hasImages && !hasLoaded && failedAttempt === attempt,
    retry: () => setAttempt((count) => count + 1),
  };
};
