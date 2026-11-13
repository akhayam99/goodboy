import type { AgentId, ProviderRunId } from '@goodboy/types';
import { tauriDatabase } from '../../../../shared/lib/db';

type Params = Readonly<{
  agentId: AgentId;
  runId: ProviderRunId;
  nowMs: number;
}>;

export const publishTurnSpawn = async ({ agentId, runId, nowMs }: Params): Promise<void> => {
  await tauriDatabase.execute(
    'UPDATE turn_admissions SET spawned_at = ?, updated_at = ? WHERE agent_id = ? AND run_id = ?',
    [nowMs, nowMs, agentId, runId],
  );
};
