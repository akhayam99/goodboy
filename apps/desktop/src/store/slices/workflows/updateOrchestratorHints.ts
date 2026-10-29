import type { IsoDateTime, OrchestratorHint, SessionId, WorkflowRunId } from '@goodboy/types';
import { updateWorkflowRunOrchestratorHints } from '@goodboy/db';
import { tauriDatabase } from '../../../shared/lib/db';
import { createKeyedQueue } from '../../../shared/utils/keyedQueue';
import { findWorkflowRun } from './findWorkflowRun';
import { consumeOrchestratorHints } from './orchestratorHintQueue';
import { patchWorkflowRun, withoutKeys } from './patchWorkflowRun';
import type { GetFn, SetFn } from './types';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly update: (hints: ReadonlyArray<OrchestratorHint>) => ReadonlyArray<OrchestratorHint>;
};

const writes = createKeyedQueue();

const applyUpdate = async ({ set, get, sessionId, workflowRunId, update }: Params) => {
  const current = findWorkflowRun({ get, sessionId, workflowRunId })?.orchestratorHints ?? [];
  const hints = update(current);
  if (hints === current) {
    return;
  }
  await updateWorkflowRunOrchestratorHints(tauriDatabase, workflowRunId, hints);
  patchWorkflowRun({
    set,
    sessionId,
    workflowRunId,
    patch: (run) =>
      hints.length === 0
        ? withoutKeys(run, ['orchestratorHints'])
        : { ...run, orchestratorHints: hints },
  });
};

export const updateOrchestratorHints = (params: Params): Promise<void> => {
  return writes.run({
    key: params.workflowRunId,
    task: () => applyUpdate(params),
  });
};

type ConsumeParams = Omit<Params, 'update'> & {
  readonly readIds: ReadonlySet<string>;
  readonly step: number;
  readonly consumedAt: IsoDateTime;
};

type ConsumeUpdateParams = Pick<ConsumeParams, 'readIds' | 'step' | 'consumedAt'>;

const consumingUpdate =
  ({ readIds, step, consumedAt }: ConsumeUpdateParams) =>
  (hints: ReadonlyArray<OrchestratorHint>) =>
    consumeOrchestratorHints({ hints, readIds, consumedAt, step });

export const consumeReadOrchestratorHints = async ({
  readIds,
  step,
  consumedAt,
  ...target
}: ConsumeParams): Promise<void> => {
  if (readIds.size === 0) {
    return;
  }
  try {
    await updateOrchestratorHints({
      ...target,
      update: consumingUpdate({ readIds, step, consumedAt }),
    });
  } catch (error) {
    await target.get().reportError({
      title: "Couldn't mark the hints as read",
      error,
      sessionId: target.sessionId,
    });
  }
};
