import type { AgentId, AutoDelegationId, ProviderRunId } from '@goodboy/types';
import { tauriDatabase } from '../../../../shared/lib/db';
import { readLaunchId } from '../../../../shared/lib/readLaunchId';

type Params = Readonly<{
  agentId: AgentId;
  delegationId: AutoDelegationId | null;
  runId: ProviderRunId;
}>;

const MEMBERSHIP_CHANGED = 'auto_membership_changed';

const LATEST_DELEGATION_IS = `SELECT 1 WHERE (
  SELECT id FROM auto_delegations WHERE child_agent_id = ?
  ORDER BY created_at DESC, rowid DESC LIMIT 1
) IS ?`;

const RECORD_ADMISSION = `INSERT INTO turn_admissions
  (id, agent_id, run_id, owner_launch, claimed_at, created_at, updated_at)
  SELECT id, id, ?, ?, ?, ?, ? FROM agents WHERE id = ? AND deleted_at IS NULL`;

export const claimTurnAdmission = async ({
  agentId,
  delegationId,
  runId,
}: Params): Promise<boolean> => {
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
  return outcome.status === 'committed';
};
