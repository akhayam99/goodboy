import { useMemo } from 'react';
import type { AutoDelegation } from '@goodboy/db';
import type { Agent, AgentId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { useTranscript } from '../../../../../store/slices/transcripts/selectors';
import { lastToolOf } from '../../../../chat/utils/lastToolOf';
import { reduceTranscript } from '../../../../chat/utils/transcript-items';
import { autoChildLive } from '../../../../live-state/adapters/autoChildLive';
import type { TailFacts } from '../../../../live-state/tailFacts';

type Params = {
  readonly delegation: AutoDelegation;
  readonly agent: Pick<Agent, 'status' | 'stoppedBy' | 'stoppedAt'> | null;
  readonly project?: string | null;
};

const NO_AGENT = { status: 'running' } as const satisfies Pick<Agent, 'status'>;

export const useChildLive = ({ delegation, agent, project = null }: Params): TailFacts | null => {
  const childAgentId: AgentId = delegation.childAgentId;
  const isOpen = delegation.state !== 'settled';
  const turn = useAppStore((state) => state.agentTurnState[childAgentId] ?? null);
  const events = useTranscript(isOpen ? childAgentId : null);
  const lastTool = useMemo(
    () => (events.length === 0 ? null : lastToolOf({ lastItem: reduceTranscript(events).at(-1) })),
    [events],
  );
  return autoChildLive({
    delegation,
    turn,
    agent: agent ?? NO_AGENT,
    lastTool,
    project,
  });
};
