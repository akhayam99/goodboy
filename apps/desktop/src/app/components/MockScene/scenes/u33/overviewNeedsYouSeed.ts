import { brandId, type Agent, type AgentId, type ProviderRunId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import { sceneClock } from '../../sceneClock';
import { COLUMN_SESSION_ID, seedCentralColumn } from '../u26/centralColumnSeed';

const clock = sceneClock({ anchor: '2026-10-18T10:31:00.000Z' });

type AtParams = {
  readonly time: string;
};

const at = ({ time }: AtParams) => clock.iso({ at: `2026-10-18T${time}:00.000Z` });

const SECOND_AGENT_ID = brandId<AgentId>({ value: 'mock-u33-needs-you-agent-notify' });
const SECOND_RUN_ID = brandId<ProviderRunId>({ value: 'mock-u33-needs-you-run-notify' });

export const seedOverviewNeedsYou = (): void => {
  seedCentralColumn({ kind: 'agent' });
  const asked = useAppStore.getState();
  const first = asked.sessionPhaseRuns[COLUMN_SESSION_ID]?.find(
    (agent) => agent.status === 'running',
  );
  if (first === undefined) {
    return;
  }
  const second: Agent = {
    ...first,
    id: SECOND_AGENT_ID,
    name: 'Check the notify-relay retries',
    kind: 'tester',
    ordinal: first.ordinal + 1,
    startedAt: at({ time: '10:12' }),
  };
  const firstTurn = asked.agentTurnState[first.id];
  const firstEvents = asked.transcripts[first.id] ?? [];
  seedCentralColumn({ kind: 'stuck' });
  useAppStore.setState((state) => ({
    sessionPhaseRuns: {
      ...state.sessionPhaseRuns,
      [COLUMN_SESSION_ID]: [...(state.sessionPhaseRuns[COLUMN_SESSION_ID] ?? []), first, second],
    },
    transcripts: {
      ...state.transcripts,
      [first.id]: firstEvents,
      [second.id]: firstEvents.map((event) =>
        event.kind === 'permission_request'
          ? { ...event, runId: SECOND_RUN_ID, input: { command: 'pnpm test notify-relay' } }
          : { ...event, runId: SECOND_RUN_ID },
      ),
    },
    agentTurnState:
      firstTurn === undefined
        ? state.agentTurnState
        : {
            ...state.agentTurnState,
            [first.id]: firstTurn,
            [second.id]: { ...firstTurn, runId: SECOND_RUN_ID },
          },
  }));
};
