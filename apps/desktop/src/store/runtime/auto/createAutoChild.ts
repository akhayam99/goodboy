import { getAgentById, insertAgent, type AutoDelegation, type Database } from '@goodboy/db';
import { PROVIDER_IDS, type Agent, type AgentId, type SessionId } from '@goodboy/types';
import { EFFORT_LEVELS } from '../../../features/chat/utils/chat-constants';

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

type RoutingTextParams = {
  readonly delegation: AutoDelegation;
  readonly key: string;
};

const routingText = ({ delegation, key }: RoutingTextParams): string | undefined => {
  const value = delegation.routing[key];
  return typeof value === 'string' ? value : undefined;
};

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
  const providerText = routingText({ delegation, key: 'provider' });
  const effortText = routingText({ delegation, key: 'effort' });
  const modelText = routingText({ delegation, key: 'model' });
  const provider = PROVIDER_IDS.find((candidate) => candidate === providerText);
  const effort = EFFORT_LEVELS.find((level) => level === effortText);
  try {
    const agent = await insertAgent(db, {
      id: delegation.childAgentId,
      sessionId,
      ordinal: await nextOrdinal({ db, sessionId }),
      name,
      status: 'pending',
      kind,
      parentAgentId,
      ...(modelText === undefined ? {} : { modelOverride: modelText }),
      ...(provider === undefined ? {} : { providerOverride: provider }),
      ...(effort === undefined ? {} : { effort }),
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
