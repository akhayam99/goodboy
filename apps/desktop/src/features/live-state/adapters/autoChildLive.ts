import { NAMES } from '../../../shared/utils/names';
import type { AutoDelegation, AutoOutcome } from '@goodboy/db';
import type { Agent, TurnState } from '@goodboy/types';
import { autoSettledStateOf } from '../../auto/autoSettledStateOf';
import { settledStatusOf } from '../../auto/chat/settledStatusOf';
import { closedSentenceOf } from '../../auto/closedSentenceOf';
import { delegationClosedOf } from '../../auto/delegationClosedOf';
import { delegationSentenceOf } from '../../auto/delegationSentenceOf';
import { TAIL_ACTION } from '../tailAction';
import type { TailFacts } from '../tailFacts';
import type { LastTool } from '../workingPhraseOf';
import { stoppedPhraseOf } from '../stoppedPhraseOf';
import { agentTurnLive } from './agentTurnLive';

export type AutoChildLiveParams = Readonly<{
  delegation: Pick<AutoDelegation, 'state' | 'outcome' | 'reason' | 'result'> &
    Partial<Pick<AutoDelegation, 'request'>>;
  isReplaced: boolean;
  turn: TurnState | null;
  agent: Pick<Agent, 'status' | 'stoppedBy' | 'stoppedAt'>;
  lastTool: LastTool | null;
  project: string | null;
}>;

const RETRY = [TAIL_ACTION.retryThroughAuto];

const CONTINUE = [{ ...TAIL_ACTION.retryThroughAuto, label: NAMES.continue }];

const FAILURE_SENTENCE = {
  failed: 'The agent did not finish.',
  timed_out: 'The agent ran out of time.',
} as const satisfies Record<Exclude<AutoOutcome, 'completed' | 'stopped' | 'blocked'>, string>;

const RETURNED_PHRASE = 'Returned to the Lead';

type ReturnedParams = {
  readonly delegation: Pick<AutoDelegation, 'outcome' | 'reason' | 'result'>;
};

const returnedFactsOf = ({ delegation }: ReturnedParams): TailFacts => {
  const sentence = delegationSentenceOf({ delegation });
  return {
    state: 'idle',
    phrase: sentence === null ? RETURNED_PHRASE : `${RETURNED_PHRASE}: ${sentence}`,
    startedAt: null,
    actions: [],
  };
};

const STOPPED_BY_AUTO = stoppedPhraseOf({ by: 'auto' });

type StoppedChildParams = {
  readonly delegation: Pick<AutoDelegation, 'reason'>;
  readonly agent: Pick<Agent, 'stoppedBy'>;
};

const stoppedChildPhraseOf = ({ delegation, agent }: StoppedChildParams): string => {
  const reason = delegation.reason ?? '';
  return reason.startsWith(STOPPED_BY_AUTO) ? reason : stoppedPhraseOf({ by: agent.stoppedBy });
};

const QUEUED: TailFacts = {
  state: 'queued',
  phrase: 'Queued',
  startedAt: null,
  actions: [TAIL_ACTION.stopAgent],
};

const WAITS_FOR_OK: TailFacts = {
  state: 'needsYou',
  phrase: NAMES.needsYou,
  startedAt: null,
  actions: [TAIL_ACTION.confirmDelegation, TAIL_ACTION.declineDelegation],
};

const ASKED: TailFacts = {
  state: 'needsYou',
  phrase: 'Needs your answer',
  startedAt: null,
  actions: [],
};

const WORKING: TailFacts = {
  state: 'working',
  phrase: NAMES.running,
  startedAt: null,
  actions: [TAIL_ACTION.stopAgent],
};

export const autoChildLive = ({
  delegation,
  isReplaced,
  turn,
  agent,
  lastTool,
  project,
}: AutoChildLiveParams): TailFacts | null => {
  const closed =
    delegation.request === undefined
      ? null
      : delegationClosedOf({ delegation: { request: delegation.request } });
  if (delegation.state === 'settled' && closed !== null) {
    return {
      state: 'idle',
      phrase: closedSentenceOf({ mark: closed }),
      startedAt: null,
      actions: [],
    };
  }
  if (delegation.state === 'settled') {
    if (delegation.outcome === 'stopped') {
      return {
        state: 'stopped',
        phrase: stoppedChildPhraseOf({ delegation, agent }),
        startedAt: null,
        actions: CONTINUE,
      };
    }
    if (delegation.outcome === 'completed' || delegation.outcome === null) {
      return null;
    }
    if (delegation.outcome === 'blocked') {
      return autoSettledStateOf({ outcome: delegation.outcome, isReplaced }) === 'done'
        ? null
        : returnedFactsOf({ delegation });
    }
    const sentence = delegationSentenceOf({ delegation }) ?? FAILURE_SENTENCE[delegation.outcome];
    const word = settledStatusOf({ outcome: delegation.outcome }).word;
    return {
      state: delegation.outcome === 'timed_out' ? 'needsYou' : 'failed',
      phrase: `${word}: ${sentence}`,
      startedAt: null,
      actions: RETRY,
    };
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
  if (live.state === 'stopped') {
    return { ...live, actions: CONTINUE };
  }
  return live.state === 'failed' ? { ...live, actions: RETRY } : live;
};
