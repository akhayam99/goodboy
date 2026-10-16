import type { TurnState } from '@goodboy/types';
import type { WorkNodeState } from '@goodboy/ui';
import type { AutoTreeView } from '../../store/slices/auto-view/state';
import { isAutoPlanAwaitingApproval } from './isAutoPlanAwaitingApproval';
import { projectAskOf } from './chat/projectAskOf';

export type AutoTreeWord = Readonly<{
  word: string;
  node: WorkNodeState;
  isLive: boolean;
}>;

type Params = {
  readonly view: AutoTreeView;
  readonly rootTurn: TurnState | null;
};

const NEEDS_YOU: AutoTreeWord = { word: 'Needs you', node: 'approval', isLive: false };
const RUNNING: AutoTreeWord = { word: 'Running', node: 'running', isLive: true };

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
  if (phase === 'stopped') {
    return { word: 'Stopped', node: 'stopped', isLive: false };
  }
  if (phase === 'finished') {
    return { word: 'Done', node: 'done', isLive: false };
  }
  if (phase === 'blocked') {
    return { word: 'Needs you', node: 'alert', isLive: false };
  }
  if (projectAskOf({ view }) !== null || isAutoPlanAwaitingApproval({ view })) {
    return NEEDS_YOU;
  }
  if (phase !== 'done' && isPausedAtLimit({ view })) {
    return NEEDS_YOU;
  }
  if (rootTurn?.kind === 'running' || rootTurn?.kind === 'starting') {
    return RUNNING;
  }
  if (phase === 'done') {
    return { word: 'Idle', node: 'closed', isLive: false };
  }
  return RUNNING;
};
