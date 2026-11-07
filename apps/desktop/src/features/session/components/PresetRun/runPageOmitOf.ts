import { RUN_LIVE_VERB_IDS } from './runLiveVerbIds';

const OFF_THE_MENU: ReadonlyArray<string> = [
  'workflowRun.open',
  'workflowRun.answer',
  'workflowRun.start',
  'workflowRun.continue',
  'workflowRun.restartStep',
  'workflowRun.nextStep',
  'workflowRun.restore',
  'workflowRun.autonomy',
  'workflowRun.stepTranscript',
  'workflowRun.stepRename',
];

const PAST_FIVE_ROWS_LIVE: ReadonlyArray<string> = [
  'workflowRun.diff',
  'workflowRun.saveAsPreset',
  'workflowRun.copySummary',
  'workflowRun.delete',
];

const PAST_FIVE_ROWS_ENDED: ReadonlyArray<string> = [
  'workflowRun.routing',
  'workflowRun.close',
  'workflowRun.copySummary',
];

type Params = {
  readonly isEnded: boolean;
  readonly isLive: boolean;
};

export const runPageOmitOf = ({ isEnded, isLive }: Params): ReadonlyArray<string> => [
  ...OFF_THE_MENU,
  ...(isEnded ? PAST_FIVE_ROWS_ENDED : PAST_FIVE_ROWS_LIVE),
  ...(isLive ? RUN_LIVE_VERB_IDS : ['workflowRun.routing']),
];
