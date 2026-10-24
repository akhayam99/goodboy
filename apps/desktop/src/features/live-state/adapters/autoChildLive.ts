import type { AutoDelegation, AutoOutcome } from '@goodboy/db';
import type { Agent, TurnState } from '@goodboy/types';
import { TAIL_ACTION } from '../tailAction';
import type { TailFacts } from '../tailFacts';
import type { LastTool } from '../workingPhraseOf';
import { agentTurnLive } from './agentTurnLive';

export type AutoChildLiveParams = Readonly<{
  delegation: Pick<AutoDelegation, 'state' | 'outcome' | 'reason'>;
  turn: TurnState | null;
  agent: Pick<Agent, 'status' | 'stoppedBy' | 'stoppedAt'>;
  lastTool: LastTool | null;
  project: string | null;
}>;

const RETRY = [TAIL_ACTION.retryThroughAuto];

const FAILURE_REASON = {
  failed: 'the agent did not finish',
  blocked: 'the agent was blocked',
  timed_out: 'the agent ran out of time',
} as const satisfies Record<Exclude<AutoOutcome, 'completed' | 'stopped'>, string>;

const QUEUED: TailFacts = {
  state: 'queued',
  phrase: 'Queued',
  startedAt: null,
  actions: [TAIL_ACTION.stopAgent],
};

const WAITS_FOR_OK: TailFacts = {
  state: 'needsYou',
  phrase: 'Waiting for your OK',
  startedAt: null,
  actions: [TAIL_ACTION.confirmDelegation, TAIL_ACTION.declineDelegation],
};

const ASKED: TailFacts = {
  state: 'needsYou',
  phrase: 'Asked a question',
  startedAt: null,
  actions: [],
};

const WORKING: TailFacts = {
  state: 'working',
  phrase: 'Working',
  startedAt: null,
  actions: [TAIL_ACTION.stopAgent],
};

export const autoChildLive = ({
  delegation,
  turn,
  agent,
  lastTool,
  project,
}: AutoChildLiveParams): TailFacts | null => {
  if (delegation.state === 'settled') {
    if (delegation.outcome === 'stopped') {
      return { state: 'stopped', phrase: 'Stopped', startedAt: null, actions: RETRY };
    }
    if (delegation.outcome === 'completed' || delegation.outcome === null) {
      return null;
    }
    const reason = delegation.reason ?? FAILURE_REASON[delegation.outcome];
    return { state: 'failed', phrase: `Failed: ${reason}`, startedAt: null, actions: RETRY };
  }
  if (delegation.state === 'accepted') {
    return QUEUED;
  }
  if (delegation.state === 'awaiting_confirm') {
    return WAITS_FOR_OK;
  }
  if (delegation.state === 'paused' || turn?.kind === 'blocked') {
    return ASKED;
  }
  const live = agentTurnLive({
    turn,
    agent,
    lastTool,
    project,
    hasQueuedMessage: false,
    stopAction: TAIL_ACTION.stopAgent,
  });
  if (live === null) {
    return WORKING;
  }
  return live.state === 'failed' || live.state === 'stopped' ? { ...live, actions: RETRY } : live;
};
