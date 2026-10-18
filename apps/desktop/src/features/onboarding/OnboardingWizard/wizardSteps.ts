export type WizardMode = 'full' | 'setup' | 'single';

export type WizardStepId = 'welcome' | 'agents' | 'workspace' | 'tools' | 'first-session';

export type NumberedWizardStepId = Exclude<WizardStepId, 'welcome'>;

export const NUMBERED_WIZARD_STEPS = [
  'agents',
  'workspace',
  'tools',
  'first-session',
] as const satisfies ReadonlyArray<NumberedWizardStepId>;

export const WIZARD_STEPS = [
  'welcome',
  ...NUMBERED_WIZARD_STEPS,
] as const satisfies ReadonlyArray<WizardStepId>;

export const WIZARD_STEP_LABEL: Readonly<Record<NumberedWizardStepId, string>> = {
  agents: 'Agents',
  workspace: 'Workspace',
  tools: 'Tools',
  'first-session': 'First session',
};

export const OPTIONAL_WIZARD_STEPS: ReadonlySet<NumberedWizardStepId> = new Set(['tools']);

const STEPS_NEEDING_A_WORKSPACE: ReadonlySet<NumberedWizardStepId> = new Set([
  'tools',
  'first-session',
]);

const SETUP_START: NumberedWizardStepId = 'agents';

export const isNumberedStep = (step: WizardStepId): step is NumberedWizardStepId =>
  step !== 'welcome';

export const isNumberedStepId = (value: string): value is NumberedWizardStepId =>
  NUMBERED_WIZARD_STEPS.some((step) => step === value);

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
  if (mode === 'setup') {
    return NUMBERED_WIZARD_STEPS;
  }
  return WIZARD_STEPS;
};

export const firstWizardStep = ({ mode, start }: VisibleParams): WizardStepId => {
  const steps = visibleWizardSteps({ mode, start });
  if (start !== null && steps.includes(start)) {
    return start;
  }
  if (mode === 'setup') {
    return 'tools';
  }
  return steps[0] ?? 'welcome';
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
