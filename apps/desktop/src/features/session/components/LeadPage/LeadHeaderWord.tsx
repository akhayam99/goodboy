import { StateDot } from '@goodboy/ui';
import type { AgentId, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import { autoDotOf } from '../../../auto/autoDotOf';
import { autoTreeWordOf } from '../../../auto/autoTreeWordOf';
import { useRunRoutes } from '../../hooks/useRunRoutes';
import { runKindLineOf } from '../../startKind/runKindLineOf';

type Props = {
  readonly sessionId: SessionId;
  readonly rootAgentId: AgentId;
};

export const LeadHeaderWord = ({ sessionId, rootAgentId }: Props) => {
  const view = useAppStore((state) =>
    state.autoTreeViews[sessionId]?.find((candidate) => candidate.tree.rootAgentId === rootAgentId),
  );
  const rootTurn = useAppStore((state) => state.agentTurnState[rootAgentId] ?? null);
  const planName = useRunRoutes({ sessionId })[rootAgentId]?.presetName ?? null;
  if (view === undefined) {
    return null;
  }
  const tree = autoTreeWordOf({ view, rootTurn });
  return (
    <span data-lead-state={tree.lead.stop} className="flex min-w-0 items-center gap-2">
      <span data-run-kind-line="" className="truncate text-meta text-muted-foreground">
        {runKindLineOf({ line: { kind: 'lead', planName } })}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <StateDot state={autoDotOf({ state: tree.state })} label={tree.word} isLive={tree.isLive} />
        <span className="text-meta text-muted-foreground">{tree.word}</span>
      </span>
    </span>
  );
};
