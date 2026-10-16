type StepParams = {
  readonly step: number;
};

type ReasonParams = {
  readonly reason: string;
};

export const ORCHESTRATED_COPY = {
  emptyTitle: 'No orchestrated runs yet',
  emptyDescription: 'The orchestrator picks each next step from your goal.',
  start: 'Orchestrate',
  showGuidance: 'Show guidance',
  hideGuidance: 'Hide guidance',
  checklist: 'Plan and progress',
  readHint: ({ step }: StepParams): string => `Your hint, read at step ${step}`,
  why: ({ reason }: ReasonParams): string => `Why: ${reason}`,
  done: 'Done',
  left: 'Left',
  composerPlaceholder: 'Hint the orchestrator',
  queuedHintsNote: 'Waits for the next decision',
  stepGone: 'This step is no longer in the run.',
  stepPane: 'Step',
  nextStep: 'Next step, not decided yet',
} as const;
