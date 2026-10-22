export const PLAN_CHANGE_KINDS = ['added', 'skipped', 'reordered'] as const;

export type PlanChangeKind = (typeof PLAN_CHANGE_KINDS)[number];

export type RunPresetStep = Readonly<{
  name: string;
  role: string | null;
  promptPrefix: string;
  isPinned: boolean;
}>;

export type RunPreset = Readonly<{
  workflowId: string;
  name: string;
  steps: ReadonlyArray<RunPresetStep>;
}>;

export type PlanChangeRequest = Readonly<{
  kind: PlanChangeKind;
  step: string;
  reason: string;
}>;

export type PlanChange = PlanChangeRequest &
  Readonly<{
    agentId: string | null;
  }>;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

type ParseParams = {
  readonly value: unknown;
};

const planChangeKindOf = ({ value }: ParseParams): PlanChangeKind | null =>
  PLAN_CHANGE_KINDS.find((kind) => kind === value) ?? null;

const presetStepOf = ({ value }: ParseParams): RunPresetStep | null => {
  if (!isRecord(value) || typeof value.name !== 'string' || value.name.trim() === '') {
    return null;
  }
  return {
    name: value.name,
    role: typeof value.role === 'string' ? value.role : null,
    promptPrefix: typeof value.promptPrefix === 'string' ? value.promptPrefix : '',
    isPinned: value.isPinned === true,
  };
};

export const parseRunPreset = ({ value }: ParseParams): RunPreset | null => {
  if (!isRecord(value) || typeof value.workflowId !== 'string' || typeof value.name !== 'string') {
    return null;
  }
  const steps: ReadonlyArray<unknown> = Array.isArray(value.steps) ? value.steps : [];
  return {
    workflowId: value.workflowId,
    name: value.name,
    steps: steps
      .map((step) => presetStepOf({ value: step }))
      .filter((step): step is RunPresetStep => step !== null),
  };
};

export const parsePlanChangeRequest = ({ value }: ParseParams): PlanChangeRequest | null => {
  if (!isRecord(value) || typeof value.step !== 'string' || value.step.trim() === '') {
    return null;
  }
  const kind = planChangeKindOf({ value: value.kind });
  if (kind === null) {
    return null;
  }
  return {
    kind,
    step: value.step.trim(),
    reason: typeof value.reason === 'string' ? value.reason.trim() : '',
  };
};

const planChangeOf = ({ value }: ParseParams): PlanChange | null => {
  const request = parsePlanChangeRequest({ value });
  if (request === null || !isRecord(value)) {
    return null;
  }
  return { ...request, agentId: typeof value.agentId === 'string' ? value.agentId : null };
};

export const parsePlanChanges = ({ value }: ParseParams): ReadonlyArray<PlanChange> => {
  const entries: ReadonlyArray<unknown> = Array.isArray(value) ? value : [];
  return entries
    .map((entry) => planChangeOf({ value: entry }))
    .filter((entry): entry is PlanChange => entry !== null);
};
