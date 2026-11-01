import type { SessionId, WorkflowOrchestrationStop, WorkflowRun } from '@goodboy/types';
import { settleHeldAnswers } from '../../open-questions/heldAnswers';
import {
  budgetBlockMessage,
  loadSpendLimitTelemetry,
  resolveSpendLimitStop,
  sessionBudgetBlockAfterLoad,
} from '../budgetBlock';
import type { GetFn, SetFn } from '../types';
import { announceRunBudget } from './announceRunBudget';

export type OrchestrationAdmission =
  | { readonly kind: 'admitted' }
  | { readonly kind: 'held' }
  | { readonly kind: 'stop'; readonly stop: WorkflowOrchestrationStop };

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly run: WorkflowRun;
  readonly isAutoAdvance: boolean;
};

export const admitOrchestration = async ({
  set,
  get,
  sessionId,
  run,
  isAutoAdvance,
}: Params): Promise<OrchestrationAdmission> => {
  const sessionBlock = await sessionBudgetBlockAfterLoad({ get, sessionId });
  if (sessionBlock !== null) {
    return {
      kind: 'stop',
      stop: { kind: 'budget', message: budgetBlockMessage({ limitUsd: sessionBlock.capUsd }) },
    };
  }
  await loadSpendLimitTelemetry({ get, sessionId, runs: [run] });
  const spendStop = resolveSpendLimitStop({ get, sessionId, run });
  if (spendStop?.kind === 'pause') {
    return { kind: 'stop', stop: { kind: 'budget', message: spendStop.message } };
  }
  if (spendStop != null) {
    announceRunBudget({ set, get, sessionId, workflowRunId: run.id, stop: spendStop });
  }
  const heldAnswers = await settleHeldAnswers({
    set,
    get,
    sessionId,
    workflowRunId: run.id,
    isStopIgnored: !isAutoAdvance,
  });
  return heldAnswers === 'blocked' ? { kind: 'held' } : { kind: 'admitted' };
};
