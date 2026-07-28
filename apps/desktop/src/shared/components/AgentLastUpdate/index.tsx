import type { Agent } from '@goodboy/types';
import { useNow } from '../../hooks/useNow';
import { agentLastUpdate } from '../../utils/agentLastUpdate';
import { formatRelativeAge } from '../../utils/relativeDate';

type Props = {
  readonly agent: Agent;
};

export const AgentLastUpdate = ({ agent }: Props) => {
  const lastUpdate = agentLastUpdate({ agent });
  const nowMs = useNow(60_000, lastUpdate !== null);
  if (lastUpdate === null) {
    return <span className="text-2xs text-muted-foreground/60">not started</span>;
  }
  return (
    <span className="text-2xs tabular-nums text-muted-foreground/60">
      {`updated ${formatRelativeAge({ fromIso: lastUpdate, nowMs })}`}
    </span>
  );
};
