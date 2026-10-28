import type { AgentId, MountId, SessionId } from '@goodboy/types';
import type { BranchPushFix } from './types';

type Params = {
  readonly fixes: Readonly<Record<AgentId, BranchPushFix>>;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
};

export const branchPushFixAgentOf = ({ fixes, sessionId, mountId }: Params): AgentId | null =>
  Object.values(fixes).find((fix) => fix.sessionId === sessionId && fix.mountId === mountId)
    ?.agentId ?? null;
