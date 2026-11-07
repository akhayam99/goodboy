import type { TurnState } from '@goodboy/types';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { NAMES } from '../../../shared/utils/names';
import { planNeedsApprovalOf } from '../../../shared/utils/planNeedsApprovalOf';
import { glanceOf, type Glance } from '../../session/glance/glanceOf';
import { projectAskOf } from '../chat/projectAskOf';
import { dockPlanRowOf } from '../dockPlanRowOf';
import { isAutoPlanAwaitingApproval } from '../isAutoPlanAwaitingApproval';
import { joinNouns } from '../joinNouns';
import { openRoleNouns } from '../openRoleNouns';
import { runningRoleNouns } from '../runningRoleNouns';

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
  if (phase === 'stopping') {
    return glanceOf({ state: 'stopping', sentence: '' });
  }
  if (phase === 'stopped') {
    return glanceOf({ state: 'stopped', sentence: 'Stopped by you. What they wrote is kept.' });
  }
  if (phase === 'finished') {
    return glanceOf({ state: 'done', sentence: stepsSentenceOf({ view }) });
  }
  if (phase === 'blocked') {
    const reason = view.tree.blockedReason;
    return glanceOf({
      state: 'failed',
      sentence: reason === null || reason === '' ? "Auto couldn't reply" : reason,
    });
  }
  const isRootTurnLive = rootTurn?.kind === 'running' || rootTurn?.kind === 'starting';
  if (phase === 'done' || phase === 'answering') {
    return isRootTurnLive
      ? glanceOf({ state: 'running', sentence: 'Auto is answering' })
      : glanceOf({ state: 'idle', sentence: 'Write to continue' });
  }
  const plan = dockPlanRowOf({ view });
  if (isAutoPlanAwaitingApproval({ view })) {
    return glanceOf({
      state: 'waiting',
      word: NAMES.needsApproval,
      sentence: planNeedsApprovalOf({ version: plan?.revision ?? 1 }),
    });
  }
  if (projectAskOf({ view }) !== null) {
    return glanceOf({ state: 'waiting', sentence: 'Auto asks which project to use' });
  }
  if (isPausedAtLimit({ view })) {
    return glanceOf({ state: 'paused', sentence: 'At the limit' });
  }
  if (plan !== null && plan.artifact.approvalState === 'revising') {
    return glanceOf({
      state: 'running',
      sentence: `The Planner is revising plan v${plan.revision}`,
    });
  }
  const nouns = openRoleNouns({ delegations: view.delegations });
  if (phase === 'waiting' && nouns.length > 0) {
    const running = runningRoleNouns({ delegations: view.delegations });
    const queued = nouns.filter((noun) => !running.includes(noun));
    const sentence = [
      ...(running.length === 0 ? [] : [`${joinNouns({ nouns: running })} running`]),
      ...(queued.length === 0 ? [] : [`${joinNouns({ nouns: queued })} queued`]),
    ].join(', ');
    return glanceOf({ state: 'running', sentence });
  }
  if (phase === 'delegating') {
    return glanceOf({ state: 'running', sentence: 'Starting agents' });
  }
  if (phase === 'merging') {
    return glanceOf({ state: 'running', sentence: 'Reading the results' });
  }
  return glanceOf({ state: 'running', sentence: 'Deciding what to do next' });
};
