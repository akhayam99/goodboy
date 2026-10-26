import type { SlotKey } from '@goodboy/core';
import { listSessionContextItemsForRole } from '@goodboy/db';
import type { AgentRole, SessionContextItem, SessionId } from '@goodboy/types';
import { ROLE_SLOTS } from '../../../features/context/slotRouting';
import { tauriDatabase } from '../../../shared/lib/db';

type Params = {
  readonly sessionId: SessionId;
  readonly role: AgentRole;
};

export type TurnAudience = {
  readonly role: AgentRole;
  readonly slots: ReadonlyArray<SlotKey>;
  readonly items: ReadonlyArray<SessionContextItem>;
};

const NO_ITEMS: ReadonlyArray<SessionContextItem> = [];

export const resolveTurnAudience = async ({ sessionId, role }: Params): Promise<TurnAudience> => {
  const items = await listSessionContextItemsForRole({
    db: tauriDatabase,
    sessionId,
    role,
  }).catch(() => NO_ITEMS);
  return { role, slots: ROLE_SLOTS[role], items };
};
