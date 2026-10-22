import {
  getWorkflowRunRulesText,
  replaceWorkflowRunRulesIfUnchanged,
  updateWorkflowRunRulesSnapshot,
} from '@goodboy/db';
import {
  DEFAULT_WORKFLOW_RULES,
  parseWorkflowRulesText,
  type SessionId,
  type WorkflowRules,
  type WorkflowRunId,
} from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { createKeyedQueue } from '../../../shared/utils/keyedQueue';
import { findWorkflowRun } from './findWorkflowRun';
import { patchWorkflowRun } from './patchWorkflowRun';
import type { GetFn, SetFn } from './types';

export type WorkflowRulesPatch = (rules: WorkflowRules) => WorkflowRules;

const MAX_ATTEMPTS = 3;

const RULES_CHANGED = 'The run rules changed in another window, try again';

const writes = createKeyedQueue();

type ApplyParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly patch: WorkflowRulesPatch;
};

type BaseParams = {
  readonly rules: WorkflowRules | null | undefined;
};

const baseRulesOf = ({ rules }: BaseParams): WorkflowRules =>
  rules ?? { ...DEFAULT_WORKFLOW_RULES, spreadByHeadroom: false };

const writeRules = async ({
  get,
  workflowRunId,
  patch,
  sessionId,
}: ApplyParams): Promise<WorkflowRules | null> => {
  for (let tries = 0; tries < MAX_ATTEMPTS; tries += 1) {
    const run = findWorkflowRun({ get, sessionId, workflowRunId });
    if (run == null) {
      return null;
    }
    const stored = await getWorkflowRunRulesText({ db: tauriDatabase, workflowRunId });
    if (stored === null) {
      const rulesSnapshot = patch(baseRulesOf({ rules: run.rulesSnapshot }));
      await updateWorkflowRunRulesSnapshot({ db: tauriDatabase, workflowRunId, rulesSnapshot });
      return rulesSnapshot;
    }
    const rulesSnapshot = patch(
      baseRulesOf({ rules: parseWorkflowRulesText({ text: stored.text }) ?? run.rulesSnapshot }),
    );
    const isWritten = await replaceWorkflowRunRulesIfUnchanged({
      db: tauriDatabase,
      workflowRunId,
      expected: stored.text,
      rulesSnapshot,
    });
    if (isWritten) {
      return rulesSnapshot;
    }
  }
  throw new Error(RULES_CHANGED);
};

const applyPatch = async (params: ApplyParams): Promise<WorkflowRules | null> => {
  const rulesSnapshot = await writeRules(params);
  if (rulesSnapshot === null) {
    return null;
  }
  patchWorkflowRun({
    set: params.set,
    sessionId: params.sessionId,
    workflowRunId: params.workflowRunId,
    patch: (current) => ({ ...current, rulesSnapshot }),
  });
  return rulesSnapshot;
};

export const updateWorkflowRunRules = (set: SetFn, get: GetFn) => {
  return (
    sessionId: SessionId,
    workflowRunId: WorkflowRunId,
    patch: WorkflowRulesPatch,
  ): Promise<WorkflowRules | null> =>
    writes.run({
      key: workflowRunId,
      task: () => applyPatch({ set, get, sessionId, workflowRunId, patch }),
    });
};
