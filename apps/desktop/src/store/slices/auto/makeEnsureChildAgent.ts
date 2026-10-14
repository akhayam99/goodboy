import { parseAutoDelegationRole } from '@goodboy/core';
import type { Database } from '@goodboy/db';
import type { SessionId } from '@goodboy/types';
import { KIND_TO_ROLE, ROLE_LABEL } from '../../../features/session/agent-kind';
import { childKindOfRole } from './childKindOfRole';
import { createAutoChild } from './createAutoChild';
import type { EnsureChildAgentParams } from './ports';

export type RefreshAgentsParams = Readonly<{
  sessionId: SessionId;
}>;

export type MakeEnsureChildAgentDeps = Readonly<{
  db: Database;
  refreshAgents: (params: RefreshAgentsParams) => Promise<void>;
}>;

export const makeEnsureChildAgent =
  ({ db, refreshAgents }: MakeEnsureChildAgentDeps) =>
  async ({ delegation, sessionId, parentAgentId }: EnsureChildAgentParams): Promise<void> => {
    const role = parseAutoDelegationRole({ role: delegation.role });
    if (role === null) {
      throw new Error(`Auto cannot create an agent for the role ${delegation.role}`);
    }
    const kind = childKindOfRole({ role });
    const outcome = await createAutoChild({
      db,
      delegation,
      sessionId,
      parentAgentId,
      name: ROLE_LABEL[KIND_TO_ROLE[kind]],
      kind,
    });
    if (outcome.kind === 'created') {
      await refreshAgents({ sessionId });
    }
  };
