import { StateDot } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { useIsWorkOn } from '../../../../shared/hooks/useIsWorkOn';
import { useAppStore } from '../../../../store';
import { autoDotOf } from '../../../auto/autoDotOf';
import { autoTreeWordOf } from '../../../auto/autoTreeWordOf';

type Props = {
  readonly sessionId: SessionId;
  readonly rootAgentId: AgentId;
};

export const LeadHeaderWord = ({ sessionId, rootAgentId }: Props) => {
  const isWork = useIsWorkOn();
  const view = useAppStore((state) =>
    state.autoTreeViews[sessionId]?.find((candidate) => candidate.tree.rootAgentId === rootAgentId),
  );
  const rootTurn = useAppStore((state) => state.agentTurnState[rootAgentId] ?? null);
  if (!isWork || view === undefined) {
    return null;
  }
  const tree = autoTreeWordOf({ view, rootTurn, isWork });
  return (
    <span data-lead-state={tree.lead.stop} className="flex shrink-0 items-center gap-2">
      <StateDot state={autoDotOf({ state: tree.state })} label={tree.word} isLive={tree.isLive} />
      <span className="text-meta text-muted-foreground">{tree.word}</span>
    </span>
  );
};
