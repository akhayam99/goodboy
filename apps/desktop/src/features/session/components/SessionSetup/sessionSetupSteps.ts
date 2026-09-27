import {
  SESSION_SETUP_STEPS,
  type SessionSetupStep,
} from '../../../../store/slices/sessionStart/state';

export type SetupStepStatus = 'done' | 'skipped' | 'current' | 'upcoming';

export type SetupStepView = {
  readonly step: SessionSetupStep;
  readonly status: SetupStepStatus;
};

type Params = {
  readonly done: ReadonlySet<SessionSetupStep>;
  readonly skipped: ReadonlyArray<SessionSetupStep>;
  readonly focus: SessionSetupStep | null;
};

export const sessionSetupSteps = ({
  done,
  skipped,
  focus,
}: Params): ReadonlyArray<SetupStepView> => {
  const open =
    SESSION_SETUP_STEPS.find((step) => !done.has(step) && !skipped.includes(step)) ?? 'work';
  const current = focus ?? open;
  return SESSION_SETUP_STEPS.map((step): SetupStepView => {
    if (step === current) {
      return { step, status: 'current' };
    }
    if (done.has(step)) {
      return { step, status: 'done' };
    }
    if (skipped.includes(step)) {
      return { step, status: 'skipped' };
    }
    return { step, status: 'upcoming' };
  });
};
