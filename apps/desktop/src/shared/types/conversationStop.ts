import type { AgentId, IsoDateTime } from '@goodboy/types';
import type { StopPhase } from '../hooks/useAgentStop';

export type ConversationStop = Readonly<{
  label: string;
  phase: StopPhase;
  sentence: string | null;
  isLineShown: boolean;
  stop: () => void;
}>;

export type ConversationLive = Readonly<{
  phrase: string;
  startedAt: IsoDateTime | null;
  waitingFor: string | null;
  stepAgentId: AgentId | null;
}>;
