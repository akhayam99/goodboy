import type { SessionId, Workflow, WorkflowRunId } from '@goodboy/types';
import { draftFromWorkflow, upsertArgsFromDraft } from '../../../features/workflows/engine';
import { uniqueWorkflowName } from '../../../features/workflows/uniqueWorkflowName';
import { findWorkflowRun } from './findWorkflowRun';
import type { GetFn } from './types';

type Params = {
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
};

export const saveRunAsPreset = (get: GetFn) => {
  return async ({ sessionId, workflowRunId }: Params): Promise<Workflow> => {
    const run = findWorkflowRun({ get, sessionId, workflowRunId });
    if (run === null) {
      throw new Error(`workflow run not found: ${workflowRunId}`);
    }
    const workflow = (get().sessionWorkflows[sessionId] ?? []).find(
      (candidate) => candidate.id === run.workflowId,
    );
    if (workflow === undefined) {
      throw new Error('This run is no longer in the session.');
    }
    if (workflow.steps.length === 0) {
      throw new Error('A run with no steps yet cannot be saved as a preset.');
    }
    const draft = draftFromWorkflow({ workflow });
    const name = uniqueWorkflowName({
      requested: run.title ?? workflow.name,
      existing: get().phaseTemplates[workflow.workspaceId] ?? [],
    });
    return get().savePhaseTemplate(
      upsertArgsFromDraft({
        workspaceId: workflow.workspaceId,
        draft: {
          ...draft,
          name,
          origin: 'custom',
          isPreset: true,
          steps: draft.steps.map((step) => ({ ...step, sourceStepId: null })),
        },
      }),
    );
  };
};
