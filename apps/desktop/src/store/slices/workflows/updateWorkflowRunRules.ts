import { updateWorkflowRunRulesSnapshot } from '@goodboy/db';
import {
  DEFAULT_WORKFLOW_RULES,
  type SessionId,
  type WorkflowRules,
  type WorkflowRunId,
} from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { findWorkflowRun } from './findWorkflowRun';
import { patchWorkflowRun } from './patchWorkflowRun';
import type { GetFn, SetFn } from './types';

export type WorkflowRulesPatch = (rules: WorkflowRules) => WorkflowRules;

export const updateWorkflowRunRules = (set: SetFn, get: GetFn) => {
  return async (
    sessionId: SessionId,
    workflowRunId: WorkflowRunId,
    patch: WorkflowRulesPatch,
  ): Promise<WorkflowRules | null> => {
    const run = findWorkflowRun({ get, sessionId, workflowRunId });
    if (run == null) {
      return null;
    }
    const rulesSnapshot = patch(
      run.rulesSnapshot ?? { ...DEFAULT_WORKFLOW_RULES, spreadByHeadroom: false },
    );
    await updateWorkflowRunRulesSnapshot({ db: tauriDatabase, workflowRunId, rulesSnapshot });
    patchWorkflowRun({
      set,
      sessionId,
      workflowRunId,
      patch: (current) => ({ ...current, rulesSnapshot }),
    });
    return rulesSnapshot;
  };
};
