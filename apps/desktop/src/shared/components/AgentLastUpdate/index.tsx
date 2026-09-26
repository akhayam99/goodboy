import type { Agent } from '@goodboy/types';
import { useNow } from '../../hooks/useNow';
import { agentLastUpdate } from '../../utils/agentLastUpdate';
import { formatRelativeAge } from '../../utils/relativeDate';

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
      return (
        <span className="text-secondary text-faint-foreground">delegated · {delegatedState}</span>
      );
    }
    return <span className="text-secondary text-faint-foreground">not started</span>;
  }
  return (
    <span className="text-secondary tabular-nums text-faint-foreground">
      {`updated ${formatRelativeAge({ fromIso: lastUpdate, nowMs })}`}
    </span>
  );
};
