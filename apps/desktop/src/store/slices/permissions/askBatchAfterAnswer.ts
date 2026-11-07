import type { AgentId, TurnEvent } from '@goodboy/types';
import { askBatchOf, type AnsweredAsk } from '../../../features/permissions/askBatchOf';

type Params = {
  readonly transcripts: Readonly<Record<AgentId, ReadonlyArray<TurnEvent>>>;
  readonly agentId: AgentId;
  readonly toolUseId: string;
};

type AskBatchAfterAnswer = Readonly<{
  isWaiting: boolean;
  held: ReadonlyArray<AnsweredAsk>;
}>;

export const askBatchAfterAnswer = ({
  transcripts,
  agentId,
  toolUseId,
}: Params): AskBatchAfterAnswer => {
  const { open, answered } = askBatchOf({ events: transcripts[agentId] ?? [] });
  return {
    isWaiting: open.length > 0,
    held: answered.filter((ask) => ask.toolUseId !== toolUseId),
  };
};
