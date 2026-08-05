import { useMemo } from 'react';
import type { Session, Workflow } from '@goodboy/types';
import { EMPTY_ARRAY, useAppStore } from '../../store';

type Params = {
  readonly session: Session;
};

export const useAttachedWorkflowRuns = ({ session }: Params) => {
  const phaseTemplates = useAppStore(
    (state) =>
      state.phaseTemplates[session.workspaceId] ?? (EMPTY_ARRAY as ReadonlyArray<Workflow>),
  );
  const sessionWorkflows = useAppStore(
    (state) => state.sessionWorkflows[session.id] ?? (EMPTY_ARRAY as ReadonlyArray<Workflow>),
  );

  return useMemo(() => {
    const workflowById = new Map<string, Workflow>();
    for (const workflow of phaseTemplates) {
      workflowById.set(workflow.id, workflow);
    }
    for (const workflow of sessionWorkflows) {
      workflowById.set(workflow.id, workflow);
    }

    return [...session.workflowRuns]
      .sort((first, second) => second.ordinal - first.ordinal)
      .flatMap((run) => {
        const workflow = workflowById.get(run.workflowId) ?? null;
        return workflow == null ? [] : [{ run, workflow }];
      });
  }, [session.workflowRuns, phaseTemplates, sessionWorkflows]);
};
