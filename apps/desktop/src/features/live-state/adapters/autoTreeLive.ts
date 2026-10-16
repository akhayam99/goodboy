import type { Agent, TurnState } from '@goodboy/types';
import { formatUsd } from '@goodboy/ui';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { refusalNoticeOf } from '../../auto/chat/refusalNoticeOf';
import { isAutoPlanAwaitingApproval } from '../../auto/isAutoPlanAwaitingApproval';
import { joinNouns } from '../../auto/joinNouns';
import { openRoleNouns } from '../../auto/openRoleNouns';
import { TAIL_ACTION } from '../tailAction';
import type { TailFacts } from '../tailFacts';
import type { LastTool } from '../workingPhraseOf';
import { agentTurnLive } from './agentTurnLive';

export type AutoTreeLiveParams = Readonly<{
  view: AutoTreeView;
  rootTurn: TurnState | null;
  rootAgent: Pick<Agent, 'status' | 'stoppedBy' | 'stoppedAt'>;
  lastTool: LastTool | null;
  project: string | null;
}>;

const STOP = [TAIL_ACTION.stopAuto];

const HANDS_OVER: ReadonlySet<AutoTreeView['tree']['phase']> = new Set([
  'delegating',
  'waiting',
  'merging',
]);

type PhraseParams = {
  readonly phrase: string;
};

type ViewParams = {
  readonly view: AutoTreeView;
};

const pausedAtLimit = ({ view }: ViewParams): TailFacts | null => {
  const budget = view.budget;
  if (budget === null || budget.capUsd === null || budget.remainingUsd === null) {
    return null;
  }
  if (Math.round(budget.remainingUsd * 100) > 0) {
    return null;
  }
  const used = formatUsd(budget.spentUsd + budget.reservedUsd);
  return {
    state: 'paused',
    phrase: `Paused at the limit: ${used} of ${formatUsd(budget.capUsd)}`,
    startedAt: null,
    actions: [TAIL_ACTION.raiseLimit, TAIL_ACTION.changeLimit],
  };
};

const working = ({ phrase }: PhraseParams): TailFacts => ({
  state: 'working',
  phrase,
  startedAt: null,
  actions: STOP,
});

export const autoTreeLive = ({
  view,
  rootTurn,
  rootAgent,
  lastTool,
  project,
}: AutoTreeLiveParams): TailFacts | null => {
  const phase = view.tree.phase;
  if (phase === 'stopping') {
    return { state: 'working', phrase: 'Stopping', startedAt: null, actions: [] };
  }
  if (phase === 'stopped') {
    return { state: 'stopped', phrase: 'Stopped by you', startedAt: null, actions: [] };
  }
  if (phase === 'blocked') {
    return {
      state: 'failed',
      phrase: 'Blocked, open the chat',
      startedAt: null,
      actions: [TAIL_ACTION.viewTranscript],
    };
  }
  const paused = pausedAtLimit({ view });
  if (paused !== null && phase !== 'done') {
    return paused;
  }
  if (rootTurn?.kind === 'running') {
    return agentTurnLive({
      turn: rootTurn,
      agent: rootAgent,
      lastTool,
      project,
      hasQueuedMessage: false,
      stopAction: TAIL_ACTION.stopAuto,
    });
  }
  if (phase === 'deciding' || phase === 'answering') {
    return working({ phrase: 'Deciding what to do next' });
  }
  if (view.pendingRefusal !== null && HANDS_OVER.has(phase)) {
    return working({ phrase: refusalNoticeOf({ refusal: view.pendingRefusal }) });
  }
  if (phase === 'delegating') {
    return working({ phrase: 'Starting agents' });
  }
  if (phase === 'merging') {
    return working({ phrase: 'Reading the results' });
  }
  if (phase === 'waiting') {
    if (isAutoPlanAwaitingApproval({ view })) {
      return null;
    }
    const nouns = openRoleNouns({ delegations: view.delegations });
    return {
      state: 'waiting',
      phrase: nouns.length === 0 ? 'Reading the results' : `Waiting for ${joinNouns({ nouns })}`,
      startedAt: null,
      actions: [TAIL_ACTION.changeApproach, TAIL_ACTION.stopAuto],
    };
  }
  if (phase === 'finished') {
    return { state: 'idle', phrase: 'Finished. Write to reopen.', startedAt: null, actions: [] };
  }
  return { state: 'idle', phrase: 'Idle', startedAt: null, actions: [] };
};
