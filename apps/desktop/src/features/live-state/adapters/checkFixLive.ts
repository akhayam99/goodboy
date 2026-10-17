import type { Agent, TurnState } from '@goodboy/types';
import { TAIL_ACTION } from '../tailAction';
import type { TailFacts } from '../tailFacts';
import type { LastTool } from '../workingPhraseOf';
import { agentTurnLive } from './agentTurnLive';

export type CheckFixLiveParams = Readonly<{
  checkName: string;
  turn: TurnState | null;
  agent: Pick<Agent, 'status' | 'stoppedBy' | 'stoppedAt'>;
  lastTool: LastTool | null;
  project: string | null;
}>;

export const checkFixLive = ({
  checkName,
  turn,
  agent,
  lastTool,
  project,
}: CheckFixLiveParams): TailFacts | null => {
  const facts = agentTurnLive({
    turn,
    agent,
    lastTool,
    project,
    hasQueuedMessage: false,
    stopAction: TAIL_ACTION.stopAgent,
  });
  if (facts === null || facts.state !== 'working') {
    return facts;
  }
  return { ...facts, phrase: `Fixing ${checkName}: ${facts.phrase.toLowerCase()}` };
};
