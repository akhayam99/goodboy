import type { AgentId, IsoDateTime, ProviderRunId } from '@goodboy/types';
import { tauriDatabase } from '../../../../shared/lib/db';

type Params = Readonly<{
  agentId: AgentId;
  runId: ProviderRunId;
  completedAt: IsoDateTime;
}>;

const FAIL_OWNED_RUN = `UPDATE agents SET
    status           = 'failed',
    last_finished_at = COALESCE(?, last_finished_at, ?),
    stopped_at       = NULL,
    stopped_by       = NULL
  WHERE id = ? AND provider_run_id IS ?`;

export const failOwnedRun = async ({ agentId, runId, completedAt }: Params): Promise<void> => {
  await tauriDatabase.execute(FAIL_OWNED_RUN, [
    Date.parse(completedAt),
    Date.now(),
    agentId,
    runId,
  ]);
};
