export const STEP_ENDED_COPY = {
  title: 'This step ended without a result',
  body: 'The agent stopped without saying it was done or asking you anything.',
  continueAction: 'Continue',
  markDoneAction: 'Mark step done',
  continueFailed: "Couldn't continue the step",
  markDoneFailed: "Couldn't mark the step done",
} as const;
