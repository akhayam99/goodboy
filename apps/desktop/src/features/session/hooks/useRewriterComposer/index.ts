import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectMountById } from '../../../../store/slices/project-mounts/selectors';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly isRewriter: boolean;
};

type RewriterComposer = {
  readonly isLive: boolean;
  readonly worktreePath: string | null;
};

export const useRewriterComposer = ({
  sessionId,
  agentId,
  isRewriter,
}: Params): RewriterComposer | null => {
  const isLive = useAppStore((s) => s.historyRewriters[agentId] !== undefined);
  const worktreePath = useAppStore((s) => {
    const run = Object.values(s.historyRuns).find((candidate) => candidate.agentId === agentId);
    const mountId = run?.mountId ?? s.historyRewriters[agentId]?.mountId;
    if (mountId === undefined) {
      return null;
    }
    return selectMountById({ state: s, sessionId, mountId })?.worktreePath ?? null;
  });
  if (!isRewriter) {
    return null;
  }
  return { isLive, worktreePath };
};
