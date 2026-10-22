import {
  getWorkflowRunRulesText,
  replaceWorkflowRunRulesIfUnchanged,
  updateWorkflowRunOrchestrationStop,
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
import { patchWorkflowRun, withoutKeys } from './patchWorkflowRun';
import type { GetFn, SetFn } from './types';

export type WorkflowRulesPatch = (rules: WorkflowRules) => WorkflowRules | null;

type WorkflowRulesWriteOptions = {
  readonly shouldClearStop?: boolean;
};

const MAX_ATTEMPTS = 3;

const RULES_CHANGED = 'The run rules changed in another window, try again';

const writes = createKeyedQueue();

type ApplyParams = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly patch: WorkflowRulesPatch;
  readonly shouldClearStop: boolean;
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
  shouldClearStop,
}: ApplyParams): Promise<WorkflowRules | null> => {
  for (let tries = 0; tries < MAX_ATTEMPTS; tries += 1) {
    const run = findWorkflowRun({ get, sessionId, workflowRunId });
    if (run == null) {
      return null;
    }
    const stored = await getWorkflowRunRulesText({ db: tauriDatabase, workflowRunId });
    if (stored === null) {
      const rulesSnapshot = patch(baseRulesOf({ rules: run.rulesSnapshot }));
      if (rulesSnapshot === null) {
        return null;
      }
      await updateWorkflowRunRulesSnapshot({ db: tauriDatabase, workflowRunId, rulesSnapshot });
      if (shouldClearStop) {
        await updateWorkflowRunOrchestrationStop(tauriDatabase, workflowRunId, null);
      }
      return rulesSnapshot;
    }
    const rulesSnapshot = patch(
      baseRulesOf({ rules: parseWorkflowRulesText({ text: stored.text }) ?? run.rulesSnapshot }),
    );
    if (rulesSnapshot === null) {
      return null;
    }
    const isWritten = await replaceWorkflowRunRulesIfUnchanged({
      db: tauriDatabase,
      workflowRunId,
      expected: stored.text,
      rulesSnapshot,
      shouldClearStop,
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
    patch: (current) =>
      params.shouldClearStop
        ? { ...withoutKeys(current, ['orchestrationStop']), rulesSnapshot }
        : { ...current, rulesSnapshot },
  });
  return rulesSnapshot;
};

export const updateWorkflowRunRules = (set: SetFn, get: GetFn) => {
  return (
    sessionId: SessionId,
    workflowRunId: WorkflowRunId,
    patch: WorkflowRulesPatch,
    options?: WorkflowRulesWriteOptions,
  ): Promise<WorkflowRules | null> =>
    writes.run({
      key: workflowRunId,
      task: () =>
        applyPatch({
          set,
          get,
          sessionId,
          workflowRunId,
          patch,
          shouldClearStop: options?.shouldClearStop === true,
        }),
    });
};
