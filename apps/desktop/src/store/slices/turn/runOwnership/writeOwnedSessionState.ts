import type { AgentId, IsoDateTime, ProviderRunId, SessionId, TurnState } from '@goodboy/types';
import { tauriDatabase } from '../../../../shared/lib/db';

type Params = Readonly<{
  sessionId: SessionId;
  agentId: AgentId;
  runId: ProviderRunId;
  state: TurnState;
  updatedAt: IsoDateTime;
}>;

const WRITE_UNLESS_TAKEN = `UPDATE sessions SET state_kind = ?, last_activity_at = ?, updated_at = ?
  WHERE id = ? AND NOT EXISTS (
    SELECT 1 FROM agents
    WHERE id = ? AND status = 'running' AND provider_run_id IS NOT ?
  )`;

export const writeOwnedSessionState = async ({
  sessionId,
  agentId,
  runId,
  state,
  updatedAt,
}: Params): Promise<void> => {
  const activityAt = state.kind === 'idle' ? state.lastActivityAt : updatedAt;
  await tauriDatabase.execute(WRITE_UNLESS_TAKEN, [
    state.kind,
    Date.parse(activityAt),
    Date.parse(updatedAt),
    sessionId,
    agentId,
    runId,
  ]);
};
