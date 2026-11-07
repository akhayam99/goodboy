import { NAMES } from './names';

type StateWordMeaning = {
  readonly word: string;
  readonly meaning: string;
};

export const STATE_WORD_MEANINGS: ReadonlyArray<StateWordMeaning> = [
  { word: NAMES.needsYou, meaning: 'Only you can move it. The sentence says what it needs.' },
  { word: NAMES.needsApproval, meaning: 'A plan waits for your approval. Counts as Needs you.' },
  {
    word: NAMES.waitingForPermission,
    meaning: 'A tool waits for your permission. Counts as Needs you.',
  },
  {
    word: NAMES.notFinished,
    meaning: 'A step stopped before its work was done. Counts as Needs you.',
  },
  { word: NAMES.running, meaning: 'Work is happening now.' },
  { word: NAMES.queued, meaning: 'Starts by itself when its turn comes.' },
  { word: NAMES.ready, meaning: 'Starts when you say so.' },
  { word: NAMES.paused, meaning: 'Held on purpose, or at a limit. Nothing new starts.' },
  { word: NAMES.failed, meaning: 'Ended on an error.' },
  { word: NAMES.stopping, meaning: 'Stopping is in progress. What it wrote is kept.' },
  { word: NAMES.stopped, meaning: 'You or a restart ended it. What it wrote is kept.' },
  { word: NAMES.done, meaning: 'Finished its work.' },
  { word: NAMES.idle, meaning: 'Nothing happening. Write to continue.' },
  { word: NAMES.notStarted, meaning: 'Ended and never ran.' },
  { word: NAMES.skipped, meaning: 'Nothing ran for this step.' },
  { word: NAMES.closed, meaning: 'You closed a failed agent out.' },
];
