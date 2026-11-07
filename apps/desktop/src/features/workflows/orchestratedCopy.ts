import { countNoun } from '../../shared/utils/countNoun';
import { NAMES } from '../../shared/utils/names';

type StepParams = {
  readonly step: number;
};

type ReasonParams = {
  readonly reason: string;
};

type SkippedParams = {
  readonly step: string;
  readonly reason: string;
};

type PresetParams = {
  readonly name: string;
  readonly closeness: string;
};

type CountParams = {
  readonly count: number;
};

type HintParams = {
  readonly hint: string;
};

export const ORCHESTRATED_COPY = {
  emptyTitle: 'No orchestrated runs yet',
  showGuidance: 'Show guidance',
  hideGuidance: 'Hide guidance',
  checklist: 'Plan and progress',
  steps: 'Steps',
  readHint: ({ step }: StepParams): string => `Read at step ${step}`,
  hintNode: 'Hint',
  hintQueued: 'Queued hint',
  hintMore: 'Show more',
  hintLess: 'Show less',
  hintMoreNamed: ({ hint }: HintParams): string => `Show more of hint: ${hint}`,
  hintLessNamed: ({ hint }: HintParams): string => `Show less of hint: ${hint}`,
  hintReading: 'Reading now',
  hintImages: 'Images in this hint',
  hintImagesFailed: "Images didn't load",
  hintImagesRetry: 'Retry',
  hintImagesLoadFailed: "Couldn't load the hint images",
  why: ({ reason }: ReasonParams): string => `Why: ${reason}`,
  done: 'Done',
  left: 'Left',
  composerPlaceholder: 'Hint the orchestrator',
  queuedHintsHeading: 'Queued, read at the next decision',
  queuedHintsLine: ({ count }: CountParams): string =>
    `${countNoun({ count, one: 'hint' })} queued`,
  queuedHintsView: 'View',
  stepGone: 'This step is no longer in the run.',
  stepPane: 'Step',
  skippedStep: ({ step, reason }: SkippedParams): string =>
    reason === '' ? `Skipped: ${step}` : `Skipped: ${step} · ${reason}`,
  fromPreset: ({ name, closeness }: PresetParams): string => `From ${name} · ${closeness}`,
  changes: ({ count }: CountParams): string => `${countNoun({ count: count, one: 'change' })}`,
  continueLabel: 'Continue with a hint',
  continueAction: 'Continue',
  hintLabel: 'Add a hint and continue',
  blockedAnswerLabel: 'Answer the step',
  blockedAnswerFailed: "Couldn't send the answer",
  answersNotDeliveredLabel: 'Answers not delivered',
  answersNotDeliveredTitle: "The agent didn't get your answers",
  blockedAsked: 'The step asked',
  openAgentChat: NAMES.openAgent,
  continueFailed: "Couldn't continue the run",
  leftOpen: ({ count }: CountParams): string => `Left open (${count})`,
} as const;
