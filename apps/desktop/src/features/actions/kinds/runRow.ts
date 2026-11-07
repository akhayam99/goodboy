import type { ObjectKindDefinition, RunRowActionTarget } from '../types';
import { WORKFLOW_RUN_KIND, type WorkflowRunFacts } from './workflowRun';

const ROW_ACTION_IDS: ReadonlySet<string> = new Set([
  'workflowRun.rename',
  'workflowRun.pause',
  'workflowRun.resume',
  'workflowRun.restore',
  'workflowRun.close',
  'workflowRun.discard',
  'workflowRun.delete',
]);

export const RUN_ROW_KIND: ObjectKindDefinition<RunRowActionTarget, WorkflowRunFacts> = {
  noun: 'run',
  facts: ({ state, target }) =>
    WORKFLOW_RUN_KIND.facts({
      state,
      target: { kind: 'workflowRun', sessionId: target.sessionId, runId: target.runId },
    }),
  actions: WORKFLOW_RUN_KIND.actions.filter((action) => ROW_ACTION_IDS.has(action.id)),
};
