import { useMemo } from 'react';
import type { Agent, Session } from '@goodboy/types';
import { Button } from '@goodboy/ui';
import { EMPTY_ARRAY, useAppStore } from '../../../../store';
import { useNow } from '../../../../shared/hooks/useNow';
import { autoRetryTargetsOf } from '../../../auto/autoRetryTargetsOf';
import { useNextCards } from '../../central/next/useNextCards';
import { useSessionWorkModel } from '../../central/useSessionWorkModel';
import { dockNextOf } from './dockNextOf';

type Props = {
  readonly session: Session;
  readonly agent: Agent;
};

const AUTO_CLOCK_MS = 15_000;

export const AgentDockNextRow = ({ session, agent }: Props) => {
  const model = useSessionWorkModel({ session });
  const agents = useAppStore((state) => state.sessionPhaseRuns[session.id] ?? EMPTY_ARRAY);
  const clock = useNow(AUTO_CLOCK_MS, model.autoTrees.length > 0);
  const autoTargets = useMemo(
    () => autoRetryTargetsOf({ views: model.autoTrees, agents, now: clock }),
    [agents, clock, model.autoTrees],
  );
  const { cards, openFor } = useNextCards({ session, model, autoTargets });
  const next = dockNextOf({ cards, agentId: agent.id });
  const open = next === null ? null : openFor({ card: next.card });
  if (next === null || open === null) {
    return null;
  }
  return (
    <div
      data-dock-row=""
      data-dock-next={next.card.id}
      className="flex min-h-7 min-w-0 items-center gap-2 text-meta text-muted-foreground"
    >
      <span className="shrink-0">Next:</span>
      <span className="min-w-0 truncate text-foreground">{next.card.title}</span>
      {next.moreCount === 0 ? null : (
        <span className="shrink-0 text-faint-foreground">{`· ${next.moreCount} more`}</span>
      )}
      <span className="flex-1" />
      <Button variant="quiet" size="xs" onClick={open}>
        Open
      </Button>
    </div>
  );
};
