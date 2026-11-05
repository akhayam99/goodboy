import type { TurnState } from '@goodboy/types';
import type { Tone } from '@goodboy/ui';
import type { AutoTreeView } from '../../../store/slices/auto-view/state';
import { AUTO_STATE_TONE } from '../chat/autoStateTone';
import { projectAskOf } from '../chat/projectAskOf';
import { isAutoPlanAwaitingApproval } from '../isAutoPlanAwaitingApproval';
import { joinNouns } from '../joinNouns';
import { openRoleNouns } from '../openRoleNouns';

export type AutoGlanceState =
  'waiting' | 'planning' | 'working' | 'stuck' | 'stopped' | 'done' | 'idle';

export type AutoGlance = Readonly<{
  state: AutoGlanceState;
  word: string;
  tone: Tone;
  sentence: string;
  isLive: boolean;
}>;

type Params = {
  readonly view: AutoTreeView;
  readonly rootTurn: TurnState | null;
};

type ViewParams = {
  readonly view: AutoTreeView;
};

type GlanceParams = {
  readonly state: AutoGlanceState;
  readonly sentence: string;
};

const WORD: Record<AutoGlanceState, string> = {
  waiting: 'Needs you',
  planning: 'Planning',
  working: 'Working',
  stuck: 'Stuck',
  stopped: 'Stopped',
  done: 'Done',
  idle: 'Idle',
};

const TONE: Record<AutoGlanceState, Tone> = {
  waiting: AUTO_STATE_TONE.waitingOnYou,
  planning: AUTO_STATE_TONE.running,
  working: AUTO_STATE_TONE.running,
  stuck: AUTO_STATE_TONE.failed,
  stopped: AUTO_STATE_TONE.idle,
  done: AUTO_STATE_TONE.done,
  idle: AUTO_STATE_TONE.idle,
};

const glanceOf = ({ state, sentence }: GlanceParams): AutoGlance => ({
  state,
  word: WORD[state],
  tone: TONE[state],
  sentence,
  isLive: state === 'planning' || state === 'working',
});

const planRowOf = ({ view }: ViewParams) =>
  view.artifacts.find((row) => row.artifact.kind === 'plan') ?? null;

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

export const autoGlanceOf = ({ view, rootTurn }: Params): AutoGlance => {
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
  const plan = planRowOf({ view });
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
