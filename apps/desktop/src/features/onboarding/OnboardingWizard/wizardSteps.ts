export type WizardMode = 'full' | 'setup' | 'single';

export type WizardStepId = 'agents' | 'workspace' | 'first-session' | 'tools';

export type NumberedWizardStepId = Exclude<WizardStepId, 'tools'>;

export const NUMBERED_WIZARD_STEPS = [
  'agents',
  'workspace',
  'first-session',
] as const satisfies ReadonlyArray<NumberedWizardStepId>;

export const WIZARD_STEPS = [
  ...NUMBERED_WIZARD_STEPS,
  'tools',
] as const satisfies ReadonlyArray<WizardStepId>;

export const WIZARD_STEP_LABEL: Readonly<Record<NumberedWizardStepId, string>> = {
  agents: 'Agents',
  workspace: 'Workspace',
  'first-session': 'First session',
};

const SIDE_STEP_OWNER: NumberedWizardStepId = 'first-session';

const LEGACY_WIZARD_STEPS: Readonly<Record<string, NumberedWizardStepId>> = {
  welcome: 'agents',
  tools: 'first-session',
};

const STEPS_NEEDING_A_WORKSPACE: ReadonlySet<NumberedWizardStepId> = new Set(['first-session']);

const SETUP_START: NumberedWizardStepId = 'agents';

export const isNumberedStep = (step: WizardStepId): step is NumberedWizardStepId =>
  step !== 'tools';

export const isNumberedStepId = (value: string): value is NumberedWizardStepId =>
  NUMBERED_WIZARD_STEPS.some((step) => step === value);

type SavedParams = {
  readonly raw: string | null;
};

export const savedWizardStepOf = ({ raw }: SavedParams): NumberedWizardStepId | null => {
  if (raw === null) {
    return null;
  }
  if (isNumberedStepId(raw)) {
    return raw;
  }
  return LEGACY_WIZARD_STEPS[raw] ?? null;
};

type DisplayParams = {
  readonly step: WizardStepId;
};

export const numberedStepOf = ({ step }: DisplayParams): NumberedWizardStepId =>
  isNumberedStep(step) ? step : SIDE_STEP_OWNER;

type ResumeParams = {
  readonly saved: NumberedWizardStepId | null;
  readonly hasWorkspace: boolean;
};

export const resumeStep = ({ saved, hasWorkspace }: ResumeParams): NumberedWizardStepId => {
  if (saved === null) {
    return SETUP_START;
  }
  if (!hasWorkspace && STEPS_NEEDING_A_WORKSPACE.has(saved)) {
    return 'workspace';
  }
  return saved;
};

type VisibleParams = {
  readonly mode: WizardMode;
  readonly start: WizardStepId | null;
};

export const visibleWizardSteps = ({ mode, start }: VisibleParams): ReadonlyArray<WizardStepId> => {
  if (mode === 'single') {
    return [start ?? 'tools'];
  }
  return WIZARD_STEPS;
};

export const firstWizardStep = ({ mode, start }: VisibleParams): WizardStepId => {
  const steps = visibleWizardSteps({ mode, start });
  if (start !== null && steps.includes(start)) {
    return start;
  }
  return steps[0] ?? 'agents';
};

export type FinishParams = {
  readonly after?: () => void;
};

export type GoToParams = {
  readonly step: WizardStepId;
};

export type WizardNav = {
  readonly mode: WizardMode;
  readonly step: WizardStepId;
  readonly isFirst: boolean;
  readonly isLast: boolean;
  readonly isLocked: boolean;
  readonly goNext: () => void;
  readonly goBack: (() => void) | null;
  readonly goTo: (params: GoToParams) => void;
  readonly finish: (params?: FinishParams) => void;
  readonly later: (params?: FinishParams) => void;
  readonly setBusy: (isBusy: boolean) => void;
};
