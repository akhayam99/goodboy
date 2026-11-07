import type { AgentId, AutoDelegationId } from '@goodboy/types';
import { tauriDatabase } from '../../../../shared/lib/db';

type Params = Readonly<{
  agentId: AgentId;
  delegationId: AutoDelegationId | null;
}>;

const MEMBERSHIP_CHANGED = 'auto_membership_changed';

const LATEST_DELEGATION_IS = `SELECT 1 WHERE (
  SELECT id FROM auto_delegations WHERE child_agent_id = ?
  ORDER BY created_at DESC, rowid DESC LIMIT 1
) IS ?`;

export const claimTurnAdmission = async ({ agentId, delegationId }: Params): Promise<boolean> => {
  const outcome = await tauriDatabase.transaction({
    statements: [
      {
        sql: LATEST_DELEGATION_IS,
        params: [agentId, delegationId],
        abortWhen: 'noRows',
        abortCode: MEMBERSHIP_CHANGED,
      },
      {
        sql: "UPDATE agents SET status = 'running' WHERE id = ? AND deleted_at IS NULL",
        params: [agentId],
      },
    ],
  });
  return outcome.status === 'committed';
};
