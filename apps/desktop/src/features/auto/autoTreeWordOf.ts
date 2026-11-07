import type { TurnState } from '@goodboy/types';
import type { WorkNodeState } from '@goodboy/ui';
import { NAMES } from '../../shared/utils/names';
import type { AutoTreeView } from '../../store/slices/auto-view/state';
import { isAutoPlanAwaitingApproval } from './isAutoPlanAwaitingApproval';
import { projectAskOf } from './chat/projectAskOf';

export type AutoTreeState =
  'stopping' | 'stopped' | 'done' | 'failed' | 'idle' | 'asking' | 'paused' | 'running';

export type AutoTreeWord = Readonly<{
  state: AutoTreeState;
  word: string;
  node: WorkNodeState;
  isLive: boolean;
}>;

type Params = {
  readonly view: AutoTreeView;
  readonly rootTurn: TurnState | null;
};

const NEEDS_YOU: AutoTreeWord = {
  state: 'asking',
  word: NAMES.needsYou,
  node: 'approval',
  isLive: false,
};
const PAUSED: AutoTreeWord = { state: 'paused', word: NAMES.paused, node: 'budget', isLive: false };
const RUNNING: AutoTreeWord = {
  state: 'running',
  word: NAMES.running,
  node: 'running',
  isLive: true,
};

type ViewParams = {
  readonly view: AutoTreeView;
};

const isPausedAtLimit = ({ view }: ViewParams): boolean => {
  const budget = view.budget;
  if (budget === null || budget.capUsd === null || budget.remainingUsd === null) {
    return false;
  }
  return Math.round(budget.remainingUsd * 100) <= 0;
};

export const autoTreeWordOf = ({ view, rootTurn }: Params): AutoTreeWord => {
  const phase = view.tree.phase;
  if (phase === 'stopping') {
    return { state: 'stopping', word: NAMES.stopping, node: 'stopped', isLive: false };
  }
  if (phase === 'stopped') {
    return { state: 'stopped', word: NAMES.stopped, node: 'stopped', isLive: false };
  }
  if (phase === 'finished') {
    return { state: 'done', word: NAMES.done, node: 'done', isLive: false };
  }
  if (phase === 'blocked') {
    return { state: 'failed', word: NAMES.failed, node: 'failed', isLive: false };
  }
  const isRootTurnLive = rootTurn?.kind === 'running' || rootTurn?.kind === 'starting';
  if (phase === 'done' || phase === 'answering') {
    return isRootTurnLive
      ? RUNNING
      : { state: 'idle', word: NAMES.idle, node: 'queued', isLive: false };
  }
  if (projectAskOf({ view }) !== null || isAutoPlanAwaitingApproval({ view })) {
    return NEEDS_YOU;
  }
  if (isPausedAtLimit({ view })) {
    return PAUSED;
  }
  return RUNNING;
};
