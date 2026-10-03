import type { SlotKey } from '@goodboy/core';
import { listSessionContextItemsForRole } from '@goodboy/db';
import type { AgentRole, SessionContextItem, SessionId } from '@goodboy/types';
import { slotsForTurn } from '../../../features/providers/slot-routing';
import { isRoleMapOn } from '../../../features/context/contextSwitches';
import type { AgentKind } from '../../../features/session/agent-kind';
import { tauriDatabase } from '../../../shared/lib/db';

type Params = {
  readonly sessionId: SessionId;
  readonly role: AgentRole;
  readonly kind: AgentKind;
  readonly settings: Readonly<Record<string, string>>;
};

export type TurnAudience = {
  readonly role: AgentRole;
  readonly slots: ReadonlyArray<SlotKey> | undefined;
  readonly items: ReadonlyArray<SessionContextItem>;
};

const NO_ITEMS: ReadonlyArray<SessionContextItem> = [];

export const resolveTurnAudience = async ({
  sessionId,
  role,
  kind,
  settings,
}: Params): Promise<TurnAudience> => {
  const isOn = isRoleMapOn({ settings });
  const slots = slotsForTurn({ role, kind, isRoleMapOn: isOn });
  if (!isOn) {
    return { role, slots, items: NO_ITEMS };
  }
  const items = await listSessionContextItemsForRole({
    db: tauriDatabase,
    sessionId,
    role,
  }).catch(() => NO_ITEMS);
  return { role, slots, items };
};
