import type { TurnState } from '@goodboy/types';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { glanceOf, type Glance } from '../../session/glance/glanceOf';
import { projectAskOf } from '../chat/projectAskOf';
import { dockPlanRowOf } from '../dockPlanRowOf';
import { isAutoPlanAwaitingApproval } from '../isAutoPlanAwaitingApproval';
import { joinNouns } from '../joinNouns';
import { openRoleNouns } from '../openRoleNouns';

type Params = {
  readonly view: AutoTreeView;
  readonly rootTurn: TurnState | null;
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

const stepsSentenceOf = ({ view }: ViewParams): string => {
  const total = view.delegations.length;
  if (total === 0) {
    return 'Nothing was delegated';
  }
  const settled = view.delegations.filter((delegation) => delegation.state === 'settled').length;
  return `${settled} of ${total} steps`;
};

export const autoGlanceOf = ({ view, rootTurn }: Params): Glance => {
  const phase = view.tree.phase;
  if (phase === 'stopped' || phase === 'stopping') {
    return glanceOf({ state: 'stopped', sentence: 'You stopped Auto, nothing is running' });
  }
  if (phase === 'finished') {
    return glanceOf({ state: 'done', sentence: stepsSentenceOf({ view }) });
  }
  if (phase === 'blocked') {
    const reason = view.tree.blockedReason;
    return glanceOf({
      state: 'stuck',
      sentence: reason === null || reason === '' ? 'Auto is blocked' : reason,
    });
  }
  const isRootTurnLive = rootTurn?.kind === 'running' || rootTurn?.kind === 'starting';
  if (phase === 'done' || phase === 'answering') {
    return isRootTurnLive
      ? glanceOf({ state: 'working', sentence: 'Auto is answering' })
      : glanceOf({ state: 'idle', sentence: 'Write to continue' });
  }
  const plan = dockPlanRowOf({ view });
  if (isAutoPlanAwaitingApproval({ view })) {
    return glanceOf({
      state: 'waiting',
      sentence: `Plan v${plan?.revision ?? 1} needs your OK`,
    });
  }
  if (projectAskOf({ view }) !== null) {
    return glanceOf({ state: 'waiting', sentence: 'Auto asks which project to use' });
  }
  if (isPausedAtLimit({ view })) {
    return glanceOf({ state: 'stuck', sentence: 'Paused at the limit' });
  }
  if (plan !== null && plan.artifact.approvalState === 'revising') {
    return glanceOf({
      state: 'planning',
      sentence: `The Planner is revising plan v${plan.revision}`,
    });
  }
  const nouns = openRoleNouns({ delegations: view.delegations });
  if (phase === 'waiting' && nouns.length > 0) {
    return glanceOf({ state: 'working', sentence: `Waiting for ${joinNouns({ nouns })}` });
  }
  if (phase === 'delegating') {
    return glanceOf({ state: 'working', sentence: 'Starting agents' });
  }
  if (phase === 'merging') {
    return glanceOf({ state: 'working', sentence: 'Reading the results' });
  }
  return glanceOf({ state: 'working', sentence: 'Deciding what to do next' });
};
