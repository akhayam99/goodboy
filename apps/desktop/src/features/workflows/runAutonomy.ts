import type { WorkflowAutonomy } from '@goodboy/types';
import { NAMES } from '../../shared/utils/names';

export type RunAutonomyOption = {
  readonly key: WorkflowAutonomy;
  readonly label: string;
  readonly hint: string;
  readonly autoRun: boolean;
};

export const RUN_AUTONOMY_HEADER = NAMES.asksYou;

const ASK_ME: RunAutonomyOption = {
  key: 'step',
  label: NAMES.everyStep,
  hint: 'Stops for your go after every step.',
  autoRun: false,
};

const BALANCED: RunAutonomyOption = {
  key: 'plan',
  label: NAMES.afterThePlan,
  hint: 'Stops once, when the plan is written.',
  autoRun: true,
};

const AUTOPILOT: RunAutonomyOption = {
  key: 'run',
  label: NAMES.asksNever,
  hint: 'Runs to the end without stopping.',
  autoRun: true,
};

export const RUN_AUTONOMY_OPTIONS: ReadonlyArray<RunAutonomyOption> = [ASK_ME, BALANCED, AUTOPILOT];

type Params = {
  readonly autoRun: boolean;
  readonly autonomy?: WorkflowAutonomy;
};

export const runAutonomyOf = ({ autoRun, autonomy }: Params): RunAutonomyOption =>
  RUN_AUTONOMY_OPTIONS.find((option) => option.key === autonomy) ?? (autoRun ? AUTOPILOT : ASK_ME);
