import type { AgentId, TurnEvent } from '@goodboy/types';
import { useAppStore } from '../..';
import { stoppedAnswerOf, type StoppedAnswer } from '../../slices/permissions/stoppedAnswerOf';

type Params = {
  readonly agentId: AgentId | null;
};

const NO_EVENTS: ReadonlyArray<TurnEvent> = [];

export const useStoppedAnswer = ({ agentId }: Params): StoppedAnswer | null => {
  const events = useAppStore((state) =>
    agentId === null ? NO_EVENTS : (state.transcripts[agentId] ?? NO_EVENTS),
  );
  const turnKind = useAppStore((state) =>
    agentId === null ? undefined : state.agentTurnState[agentId]?.kind,
  );
  return stoppedAnswerOf({ events, turnKind });
};
