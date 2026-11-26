import type { AppStore } from '../../../store/store';
import { doneResult, failedResult, refusedResult } from './handlerResults';
import type { DecidePorts, HandlerResult } from './handlerTypes';
import { sessionIdOf, treeIdOf, workflowRunIdOf } from './ids';
import type { LimitTarget } from './limitTargets';

type Params = {
  readonly store: AppStore;
  readonly ports: DecidePorts;
  readonly sessionId: string;
  readonly runId: string;
  readonly target: LimitTarget;
  readonly nextLimit: number;
  readonly failure: string;
};

export const applyLimit = async ({
  store,
  ports,
  sessionId,
  runId,
  target,
  nextLimit,
  failure,
}: Params): Promise<HandlerResult> => {
  const session = sessionIdOf({ value: sessionId });
  try {
    if (target.kind === 'session') {
      await store.setSessionBudget(session, nextLimit, target.onExceed);
      return doneResult();
    }
    if (target.kind === 'run') {
      await store.setWorkflowRunSpendLimit(
        session,
        workflowRunIdOf({ value: runId }),
        nextLimit,
        target.mode,
      );
      return doneResult();
    }
    const outcome = await ports.setTreeCap({
      sessionId: session,
      treeId: treeIdOf({ value: runId }),
      expectedCapUsd: target.limit,
      capUsd: nextLimit,
    });
    if (outcome.kind === 'applied') {
      return doneResult();
    }
    if (outcome.kind === 'stale') {
      return refusedResult({
        code: 'version-changed',
        message: 'The limit changed while you read it.',
      });
    }
    if (outcome.kind === 'below_used') {
      return refusedResult({ code: 'not-permitted', message: 'The run already spent more.' });
    }
    return refusedResult({ code: 'unknown-target', message: "This run isn't on your Mac." });
  } catch (error) {
    console.error('[bridge] limit change failed', error);
    return failedResult({ error: failure });
  }
};
