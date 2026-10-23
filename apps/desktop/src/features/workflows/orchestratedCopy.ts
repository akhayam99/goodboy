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
  continueFailed: "Couldn't continue the run",
} as const;
