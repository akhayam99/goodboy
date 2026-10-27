import { updateWorkflowRunProviderPool } from '@goodboy/db';
import type { ProviderId, SessionId, WorkflowRun, WorkflowRunId } from '@goodboy/types';
import { tauriDatabase } from '../../../shared/lib/db';
import { createLatestOnly } from '../../runtime/state-writes/latestOnly';
import { findWorkflowRun } from './findWorkflowRun';
import { withoutKeys } from './patchWorkflowRun';
import type { GetFn, SetFn } from './types';

type PoolParams = {
  readonly sessionId: SessionId;
  readonly workflowRunId: WorkflowRunId;
  readonly pool: ReadonlyArray<ProviderId> | null;
};

type Deps = {
  readonly set: SetFn;
  readonly get: GetFn;
};

type PoolOutcome = 'applied' | 'stale' | 'gone';

type WithPoolParams = {
  readonly run: WorkflowRun;
  readonly pool: ReadonlyArray<ProviderId> | null;
};

const withPool = ({ run, pool }: WithPoolParams): WorkflowRun =>
  pool === null ? withoutKeys(run, ['providerPool']) : { ...run, providerPool: pool };

const latest = createLatestOnly();

export const setWorkflowRunProviderPool =
  ({ set, get }: Deps) =>
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
        set((state) => ({
          sessions: state.sessions.map((session) =>
            session.id === sessionId
              ? {
                  ...session,
                  workflowRuns: session.workflowRuns.map((run) =>
                    run.id === workflowRunId ? withPool({ run, pool: nextPool }) : run,
                  ),
                }
              : session,
          ),
        })),
    });
  };
