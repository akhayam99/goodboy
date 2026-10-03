type RunAutonomy = 'ask' | 'own';

export type RunAutonomyOption = {
  readonly key: RunAutonomy;
  readonly label: string;
  readonly hint: string;
  readonly autoRun: boolean;
};

export const RUN_AUTONOMY_HEADER = 'When to ask';

const ASK_BEFORE_EACH_STEP: RunAutonomyOption = {
  key: 'ask',
  label: 'Ask before each step',
  hint: 'Waits for your go after each step so you can review it.',
  autoRun: false,
};

const RUN_ON_ITS_OWN: RunAutonomyOption = {
  key: 'own',
  label: 'Run on its own',
  hint: 'Each next step starts on its own.',
  autoRun: true,
};

export const RUN_AUTONOMY_OPTIONS: ReadonlyArray<RunAutonomyOption> = [
  ASK_BEFORE_EACH_STEP,
  RUN_ON_ITS_OWN,
];

type Params = {
  readonly autoRun: boolean;
};

export const runAutonomyOf = ({ autoRun }: Params): RunAutonomyOption =>
  autoRun ? RUN_ON_ITS_OWN : ASK_BEFORE_EACH_STEP;
