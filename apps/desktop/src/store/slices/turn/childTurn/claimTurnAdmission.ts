import type { AgentId, AutoDelegationId, ProviderRunId } from '@goodboy/types';
import { tauriDatabase } from '../../../../shared/lib/db';
import { readLaunchId } from '../../../../shared/lib/readLaunchId';

type Params = Readonly<{
  agentId: AgentId;
  delegationId: AutoDelegationId | null;
  runId: ProviderRunId;
}>;

type TurnAdmission = 'admitted' | 'auto_child_changed' | 'turn_running';

const MEMBERSHIP_CHANGED = 'auto_membership_changed';

const TURN_RUNNING = 'turn_running';

const LATEST_DELEGATION_IS = `SELECT 1 WHERE (
  SELECT id FROM auto_delegations WHERE child_agent_id = ?
  ORDER BY created_at DESC, rowid DESC LIMIT 1
) IS ?`;

const RUN_IN_FLIGHT = `SELECT 1 FROM agents
  JOIN provider_runs ON provider_runs.id = agents.provider_run_id
  WHERE agents.id = ? AND agents.status = 'running'
    AND provider_runs.status_kind IN ('pending', 'streaming')`;

const RECORD_ADMISSION = `INSERT INTO turn_admissions
  (id, agent_id, run_id, owner_launch, claimed_at, created_at, updated_at)
  SELECT id, id, ?, ?, ?, ?, ? FROM agents WHERE id = ? AND deleted_at IS NULL`;

export const claimTurnAdmission = async ({
  agentId,
  delegationId,
  runId,
}: Params): Promise<TurnAdmission> => {
  const launchId = await readLaunchId();
  const claimedAt = Date.now();
  const outcome = await tauriDatabase.transaction({
    statements: [
      {
        sql: LATEST_DELEGATION_IS,
        params: [agentId, delegationId],
        abortWhen: 'noRows',
        abortCode: MEMBERSHIP_CHANGED,
      },
      {
        sql: RUN_IN_FLIGHT,
        params: [agentId],
        abortWhen: 'rows',
        abortCode: TURN_RUNNING,
      },
      {
        sql: "UPDATE agents SET status = 'running', provider_run_id = ? WHERE id = ? AND deleted_at IS NULL",
        params: [runId, agentId],
      },
      {
        sql: 'DELETE FROM turn_admissions WHERE agent_id = ?',
        params: [agentId],
      },
      {
        sql: RECORD_ADMISSION,
        params: [runId, launchId, claimedAt, claimedAt, claimedAt, agentId],
      },
    ],
  });
  if (outcome.status === 'committed') {
    return 'admitted';
  }
  if (outcome.abortCode === TURN_RUNNING) {
    return 'turn_running';
  }
  return 'auto_child_changed';
};
