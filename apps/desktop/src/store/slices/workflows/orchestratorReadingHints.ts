import type { WorkflowRunId } from '@goodboy/types';
import type { SetFn } from './types';

type RunParams = {
  readonly set: SetFn;
  readonly workflowRunId: WorkflowRunId;
};

type HintsParams = RunParams & {
  readonly hintIds: ReadonlyArray<string>;
};

export const markHintsReading = ({ set, workflowRunId, hintIds }: HintsParams): void => {
  if (hintIds.length === 0) {
    return;
  }
  set((state) => {
    const current = state.orchestratorReadingHints[workflowRunId] ?? [];
    const added = hintIds.filter((hintId) => current.includes(hintId) === false);
    if (added.length === 0) {
      return {};
    }
    return {
      orchestratorReadingHints: {
        ...state.orchestratorReadingHints,
        [workflowRunId]: [...current, ...added],
      },
    };
  });
};

export const releaseHintsReading = ({ set, workflowRunId, hintIds }: HintsParams): void => {
  set((state) => {
    const current = state.orchestratorReadingHints[workflowRunId];
    if (current == null) {
      return {};
    }
    const kept = current.filter((hintId) => hintIds.includes(hintId) === false);
    if (kept.length === current.length) {
      return {};
    }
    return {
      orchestratorReadingHints:
        kept.length === 0
          ? Object.fromEntries(
              Object.entries(state.orchestratorReadingHints).filter(
                ([runId]) => runId !== workflowRunId,
              ),
            )
          : { ...state.orchestratorReadingHints, [workflowRunId]: kept },
    };
  });
};

export const clearHintsReading = ({ set, workflowRunId }: RunParams): void => {
  set((state) => {
    if (state.orchestratorReadingHints[workflowRunId] == null) {
      return {};
    }
    return {
      orchestratorReadingHints: Object.fromEntries(
        Object.entries(state.orchestratorReadingHints).filter(([runId]) => runId !== workflowRunId),
      ),
    };
  });
};
