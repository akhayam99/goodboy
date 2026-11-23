import type { AutoTreeId, SessionId } from '@goodboy/types';
import { workRowsOf } from '../../../features/work/workRowsOf';
import type { GetFn } from '../../slice-types';
import { sessionById } from '../sessions/sessionIndex';

type Params = Readonly<{
  get: GetFn;
  sessionId: SessionId;
  treeId: AutoTreeId;
}>;

const NO_TURNS = {};

export const isLeadStillOpen = async ({ get, sessionId, treeId }: Params): Promise<boolean> => {
  const workspaceId = sessionById(get().sessions, sessionId)?.workspaceId ?? null;
  if (workspaceId === null) {
    return false;
  }
  await get().loadWorkLeads({ workspaceId });
  const leads = get().workLeads.filter((lead) => lead.treeId === treeId);
  return workRowsOf({ leads, rootTurns: NO_TURNS, filter: 'open' }).rows.length > 0;
};
