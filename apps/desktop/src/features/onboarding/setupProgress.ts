import {
  NUMBERED_WIZARD_STEPS,
  OPTIONAL_WIZARD_STEPS,
  WIZARD_STEP_LABEL,
  type NumberedWizardStepId,
} from './OnboardingWizard/wizardSteps';

export type SetupItemId = NumberedWizardStepId;

type SetupRow = {
  readonly id: SetupItemId;
  readonly title: string;
  readonly isDone: boolean;
  readonly isOptional: boolean;
};

export type SetupProgress = {
  readonly rows: ReadonlyArray<SetupRow>;
  readonly done: number;
  readonly total: number;
  readonly isDone: boolean;
  readonly next: SetupItemId | null;
  readonly count: string;
  readonly fraction: number;
};

type Params = {
  readonly completed: ReadonlySet<string>;
};

export const setupProgress = ({ completed }: Params): SetupProgress => {
  const rows = NUMBERED_WIZARD_STEPS.map((id) => ({
    id,
    title: WIZARD_STEP_LABEL[id],
    isDone: completed.has(id),
    isOptional: OPTIONAL_WIZARD_STEPS.has(id),
  }));
  const done = rows.filter((row) => row.isDone).length;
  const total = rows.length;
  return {
    rows,
    done,
    total,
    isDone: done === total,
    next: rows.find((row) => !row.isDone)?.id ?? null,
    count: `${done} of ${total}`,
    fraction: total === 0 ? 0 : done / total,
  };
};
