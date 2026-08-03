import type { Agent, PendingResolution, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';
import type { ResolverThreadOutcome } from '../../../../store/types';
import { agentThreadIds } from '../../agentThreadIds';
import { resolverTallySentence } from '../../resolverTallySentence';
import { resolverThreadSettlements } from '../../resolverThreadSettlements';
import { resolverThreadTally } from '../../resolverThreadTally';
import { useClosedThreadIds } from '../../hooks/useClosedThreadIds';

type Props = {
  readonly agent: Agent;
  readonly sessionId: SessionId;
};

const EMPTY_PENDING: ReadonlyArray<PendingResolution> = [];
const EMPTY_OUTCOMES: Readonly<Record<string, ResolverThreadOutcome>> = {};

export const ResolverCardTally = ({ agent, sessionId }: Props) => {
  const pending =
    useAppStore((state) => state.sessionPendingResolutions[sessionId]) ?? EMPTY_PENDING;
  const outcomes = useAppStore((state) => state.resolverThreadOutcomes[agent.id]) ?? EMPTY_OUTCOMES;
  const closedThreadIds = useClosedThreadIds({ sessionId });

  const threadIds = agentThreadIds(agent);
  if (threadIds.length < 2) {
    return null;
  }
  const sentence = resolverTallySentence({
    tally: resolverThreadTally({
      settlements: resolverThreadSettlements({
        threadIds,
        outcomes,
        pendingResolutions: pending,
        closedThreadIds,
      }),
    }),
  });
  if (sentence === null) {
    return null;
  }

  return <span className="text-2xs tabular-nums text-muted-foreground/80">{sentence}</span>;
};
