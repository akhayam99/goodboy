import {
  AUTO_DETACH_ABORT,
  detachAdoptionStatements,
  getAdoptionOfAgent,
  type Database,
} from '@goodboy/db';
import { formatError } from '@goodboy/ui';
import type { AgentId, AutoTreeId } from '@goodboy/types';

export type DetachAdoptedParams = Readonly<{
  db: Database;
  agentId: AgentId;
  nowMs: number;
}>;

export type DetachOutcome =
  | Readonly<{ kind: 'detached'; treeId: AutoTreeId }>
  | Readonly<{ kind: 'refused'; code: 'not_adopted' | 'turn_running'; message: string }>
  | Readonly<{ kind: 'failed'; message: string }>;

const NOT_ADOPTED = 'This agent is not part of an Auto conversation.';
const TURN_RUNNING = 'Wait for the turn to end first.';

export const detachAdopted = async ({
  db,
  agentId,
  nowMs,
}: DetachAdoptedParams): Promise<DetachOutcome> => {
  try {
    const delegation = await getAdoptionOfAgent({ db, agentId });
    if (delegation === null) {
      return { kind: 'refused', code: 'not_adopted', message: NOT_ADOPTED };
    }
    const outcome = await db.transaction({
      statements: detachAdoptionStatements({ delegation, nowMs }),
    });
    if (outcome.status === 'committed') {
      return { kind: 'detached', treeId: delegation.treeId };
    }
    if (outcome.abortCode === AUTO_DETACH_ABORT.turnRunning) {
      return { kind: 'refused', code: 'turn_running', message: TURN_RUNNING };
    }
    return { kind: 'refused', code: 'not_adopted', message: NOT_ADOPTED };
  } catch (error) {
    return { kind: 'failed', message: formatError(error) };
  }
};
