import type { SessionBudgetOnExceed, WorkflowSpendLimitMode } from '@goodboy/types';

export const SPEND_LIMIT_BEHAVIOR_LABEL: Readonly<Record<SessionBudgetOnExceed, string>> = {
  pause: 'Pauses workflows',
  warn: 'Only warns',
};

export const SPEND_LIMIT_BEHAVIOR_SHORT: Readonly<Record<SessionBudgetOnExceed, string>> = {
  pause: 'Pause',
  warn: 'Warn',
};

type RunModeParams = {
  readonly mode: WorkflowSpendLimitMode;
};

export const behaviorOfRunMode = ({ mode }: RunModeParams): SessionBudgetOnExceed =>
  mode === 'notify' ? 'warn' : 'pause';

type BehaviorParams = {
  readonly behavior: SessionBudgetOnExceed;
};

export const runModeOfBehavior = ({ behavior }: BehaviorParams): WorkflowSpendLimitMode =>
  behavior === 'warn' ? 'notify' : 'pause';
