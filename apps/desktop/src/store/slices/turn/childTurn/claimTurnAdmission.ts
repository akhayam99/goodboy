import type { AgentId, AutoDelegationId, ProviderRunId } from '@goodboy/types';
import { tauriDatabase } from '../../../../shared/lib/db';

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

export const claimTurnAdmission = async ({
  agentId,
  delegationId,
  runId,
}: Params): Promise<boolean> => {
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
    ],
  });
  return outcome.status === 'committed';
};
