import { useMemo } from 'react';
import type { OrchestratorHint, WorkflowRunId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

type Params = {
  readonly runId: WorkflowRunId | null;
};

const NO_HINTS: ReadonlyArray<OrchestratorHint> = [];

export const useRunHintAttachmentIds = ({ runId }: Params): ReadonlySet<string> => {
  const hints = useAppStore((state) => {
    if (runId === null) {
      return NO_HINTS;
    }
    for (const session of state.sessions ?? []) {
      const run = session.workflowRuns.find((candidate) => candidate.id === runId);
      if (run !== undefined) {
        return run.orchestratorHints ?? NO_HINTS;
      }
    }
    return NO_HINTS;
  });
  return useMemo(() => new Set(hints.flatMap((hint) => hint.attachmentIds ?? [])), [hints]);
};
