import type { WorkflowAutonomy } from '@goodboy/types';
import { NAMES } from '../../shared/names';

export type RunAutonomyOption = {
  readonly key: WorkflowAutonomy;
  readonly label: string;
  readonly hint: string;
  readonly autoRun: boolean;
};

export const RUN_AUTONOMY_HEADER = NAMES.whenToAsk;

const ASK_BEFORE_EACH_STEP: RunAutonomyOption = {
  key: 'step',
  label: 'Ask before each step',
  hint: 'Waits for your go after each step so you can review it.',
  autoRun: false,
};

const ASK_AFTER_THE_PLAN: RunAutonomyOption = {
  key: 'plan',
  label: 'Ask after the plan',
  hint: 'Waits once after the plan, then runs on its own.',
  autoRun: true,
};

const RUN_ON_ITS_OWN: RunAutonomyOption = {
  key: 'run',
  label: 'Run on its own',
  hint: 'Each next step starts on its own.',
  autoRun: true,
};

export const RUN_AUTONOMY_OPTIONS: ReadonlyArray<RunAutonomyOption> = [
  ASK_BEFORE_EACH_STEP,
  ASK_AFTER_THE_PLAN,
  RUN_ON_ITS_OWN,
];

type Params = {
  readonly autoRun: boolean;
  readonly autonomy?: WorkflowAutonomy;
};

export const runAutonomyOf = ({ autoRun, autonomy }: Params): RunAutonomyOption =>
  RUN_AUTONOMY_OPTIONS.find((option) => option.key === autonomy) ??
  (autoRun ? RUN_ON_ITS_OWN : ASK_BEFORE_EACH_STEP);
