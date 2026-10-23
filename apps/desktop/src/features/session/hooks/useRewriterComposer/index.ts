import type { AgentId, MountId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { selectWritableMounts } from '../../../../store/slices/project-mounts/selectors';

type Params = {
  readonly sessionId: SessionId;
  readonly agentId: AgentId;
  readonly isRewriter: boolean;
};

type RewriterComposer = {
  readonly isLive: boolean;
  readonly mountId: MountId | null;
};

export const useRewriterComposer = ({
  sessionId,
  agentId,
  isRewriter,
}: Params): RewriterComposer | null => {
  const isLive = useAppStore((s) => s.historyRewriters[agentId] !== undefined);
  const mountId = useAppStore((s) => {
    const run = Object.values(s.historyRuns).find((candidate) => candidate.agentId === agentId);
    const wanted =
      run?.mountId ??
      s.historyRewriters[agentId]?.mountId ??
      (s.sessionEvents?.[sessionId] ?? []).find(
        (event) => event.kind.startsWith('history_') && event.payload?.agentId === agentId,
      )?.payload?.mountId;
    return (
      selectWritableMounts({ state: s, sessionId }).find((mount) => mount.mountId === wanted)
        ?.mountId ?? null
    );
  });
  if (!isRewriter) {
    return null;
  }
  return { isLive, mountId };
};
