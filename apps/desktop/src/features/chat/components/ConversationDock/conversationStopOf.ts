import type { StopPhase } from '../../../../shared/hooks/useAgentStop';
import { NAMES } from '../../../../shared/utils/names';
import type { ConversationStop } from '../../../../shared/types/conversationStop';

const ASKING_YOU = 'Asking you';

type AgentStop = Readonly<{
  phase: StopPhase;
  isLive: boolean;
  isBlocked: boolean;
  stop: () => void;
}>;

type Params = {
  readonly agentStop: AgentStop;
  readonly scoped: ConversationStop | null;
  readonly stopLabel: string | null;
  readonly isRunning: boolean;
  readonly sentence: string | null;
  readonly hasOpenAsk: boolean;
  readonly isStoppedAnswer: boolean;
};

export const conversationStopOf = ({
  agentStop,
  scoped,
  stopLabel,
  isRunning,
  sentence,
  hasOpenAsk,
  isStoppedAnswer,
}: Params): ConversationStop | null => {
  if (scoped !== null) {
    return scoped;
  }
  if (isStoppedAnswer || (!isRunning && !agentStop.isLive)) {
    return null;
  }
  return {
    label: stopLabel ?? NAMES.stop,
    phase: agentStop.phase,
    sentence: sentence ?? (agentStop.isBlocked && hasOpenAsk ? ASKING_YOU : null),
    stop: agentStop.stop,
  };
};
