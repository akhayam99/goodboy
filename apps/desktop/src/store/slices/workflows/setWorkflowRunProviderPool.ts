import { updateWorkflowRunProviderPool } from '@goodboy/db';
import type { ProviderId, SessionId, WorkflowRunId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { createLatestOnly } from '../state-writes/latestOnly';
import { findWorkflowRun } from './findWorkflowRun';
import { patchWorkflowRun, withoutKeys } from './patchWorkflowRun';
import type { GetFn, SetFn } from './types';

type PoolParams = {
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly pool: ReadonlyArray<ProviderId> | null;
};

type PoolOutcome = 'applied' | 'stale' | 'gone';

const latest = createLatestOnly();

export const setWorkflowRunProviderPool =
  (set: SetFn, get: GetFn) =>
  async ({ sessionId, workflowRunId, pool }: PoolParams): Promise<PoolOutcome> => {
    if (findWorkflowRun({ get, sessionId, workflowRunId }) == null) {
      return 'gone';
    }
    const nextPool = pool === null || pool.length === 0 ? null : pool;
    return latest.run({
      key: workflowRunId,
      request: () =>
        updateWorkflowRunProviderPool({ db: tauriDatabase, workflowRunId, pool: nextPool }),
      apply: () =>
        patchWorkflowRun({
          set,
          sessionId,
          workflowRunId,
          patch: (current) =>
            nextPool === null
              ? withoutKeys(current, ['providerPool'])
              : { ...current, providerPool: nextPool },
        }),
    });
  };
