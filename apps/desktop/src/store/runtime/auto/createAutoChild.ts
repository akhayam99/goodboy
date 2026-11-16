import { getAgentById, insertAgent, type AutoDelegation, type Database } from '@goodboy/db';
import { brandId, type Agent, type AgentId, type MountId, type SessionId } from '@goodboy/types';
import { autoChildRoutingOf } from '../../../features/auto/autoChildRoutingOf';
import { delegationMountIdOf } from '../../../features/auto/delegationMountIdOf';

export type CreateAutoChildParams = Readonly<{
  db: Database;
  delegation: AutoDelegation;
  sessionId: SessionId;
  parentAgentId: AgentId;
  name: string;
  kind: string;
}>;

export type CreateAutoChildOutcome = Readonly<{
  kind: 'created' | 'exists';
  agent: Agent;
}>;

type NextOrdinalParams = {
  readonly db: Database;
  readonly sessionId: SessionId;
};

const nextOrdinal = async ({ db, sessionId }: NextOrdinalParams): Promise<number> => {
  const rows = await db.select<{ readonly next: number }>(
    'SELECT COALESCE(MAX(ordinal), -1) + 1 AS next FROM agents WHERE session_id = ?',
    [sessionId],
  );
  return rows[0]?.next ?? 0;
};

export const createAutoChild = async ({
  db,
  delegation,
  sessionId,
  parentAgentId,
  name,
  kind,
}: CreateAutoChildParams): Promise<CreateAutoChildOutcome> => {
  const existing = await getAgentById(db, delegation.childAgentId);
  if (existing !== null) {
    return { kind: 'exists', agent: existing };
  }
  const mountId = delegationMountIdOf({ delegation });
  try {
    const agent = await insertAgent(db, {
      id: delegation.childAgentId,
      sessionId,
      ordinal: await nextOrdinal({ db, sessionId }),
      name,
      status: 'pending',
      kind,
      parentAgentId,
      ...(mountId !== null && { mountId: brandId<MountId>({ value: mountId }) }),
      ...autoChildRoutingOf({ delegation }),
    });
    return { kind: 'created', agent };
  } catch (error) {
    const winner = await getAgentById(db, delegation.childAgentId);
    if (winner === null) {
      throw error;
    }
    return { kind: 'exists', agent: winner };
  }
};
