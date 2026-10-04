import type { Agent } from '@goodboy/types';
import { useNow } from '../../hooks/useNow';
import { agentLastUpdate } from '../../utils/agentLastUpdate';
import { formatAge } from '../../utils/time/formatAge';

type Props = {
  readonly agent: Agent;
  readonly delegatedChildCount?: number;
  readonly activeDelegatedChildCount?: number;
};

export const AgentLastUpdate = ({
  agent,
  delegatedChildCount = 0,
  activeDelegatedChildCount = 0,
}: Props) => {
  const lastUpdate = agentLastUpdate({ agent });
  const nowMs = useNow(60_000, lastUpdate !== null);
  if (lastUpdate === null) {
    if (delegatedChildCount > 0) {
      const delegatedState =
        activeDelegatedChildCount > 0
          ? `${activeDelegatedChildCount}/${delegatedChildCount} running`
          : 'done';
      return <span className="text-meta text-faint-foreground">delegated · {delegatedState}</span>;
    }
    return <span className="text-meta text-faint-foreground">not started</span>;
  }
  return (
    <span className="text-meta tabular-nums text-faint-foreground">
      {`updated ${formatAge({ from: lastUpdate, now: nowMs })}`}
    </span>
  );
};
