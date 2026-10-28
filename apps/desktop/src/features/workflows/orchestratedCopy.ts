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

type AsksParams = {
  readonly isQuestion: boolean;
};

export const ORCHESTRATED_COPY = {
  emptyTitle: 'No orchestrated runs yet',
  showGuidance: 'Show guidance',
  hideGuidance: 'Hide guidance',
  checklist: 'Plan and progress',
  readHint: ({ step }: StepParams): string => `Your hint, read at step ${step}`,
  why: ({ reason }: ReasonParams): string => `Why: ${reason}`,
  whyThisStep: 'Why this step',
  done: 'Done',
  left: 'Left',
  composerPlaceholder: 'Hint the orchestrator',
  queuedHintsNote: 'Waits for the next decision',
  stepGone: 'This step is no longer in the run.',
  stepPane: 'Step',
  nextStep: 'Next step, not decided yet',
  skippedStep: ({ step, reason }: SkippedParams): string =>
    reason === '' ? `Skipped: ${step}` : `Skipped: ${step} · ${reason}`,
  fromPreset: ({ name, closeness }: PresetParams): string => `From ${name} · ${closeness}`,
  changes: ({ count }: CountParams): string => `${count} ${count === 1 ? 'change' : 'changes'}`,
  continueLabel: 'Continue with a hint',
  continueAction: 'Continue',
  hintLabel: 'Add a hint and continue',
  blockedAnswerLabel: 'Answer the step',
  blockedAnswerAction: 'Answer',
  questionAnswerLabel: 'Answer the question',
  questionAsks: 'The run asks',
  blockedAnswerFailed: "Couldn't send the answer",
  blockedNoReason: 'The step stopped without saying why. Tell it what to do next.',
  blockedAsks: ({ isQuestion }: AsksParams): string =>
    isQuestion ? 'The step asked' : 'The step stopped after saying',
  openAgentChat: 'Open agent chat',
  continueFailed: "Couldn't continue the run",
  leftOpen: ({ count }: CountParams): string => `Left open (${count})`,
} as const;
