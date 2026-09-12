import type {
  ModelEffort,
  ProviderId,
  WorkflowModelPick,
  WorkflowRoutingDecision,
  WorkflowRoutingLock,
  WorkflowRoutingProposal,
  WorkflowTaskDifficulty,
  WorkflowTaskProfile,
  WorkflowTaskType,
} from '@goodboy/types';

const PROVIDERS: ReadonlySet<string> = new Set([
  'anthropic',
  'cursor',
  'codex',
  'gemini',
  'opencode',
  'openrouter',
  'moonshot',
]);
const EFFORTS: ReadonlySet<string> = new Set(['minimal', 'low', 'medium', 'high', 'xhigh', 'max']);
const TASK_TYPES: ReadonlySet<string> = new Set([
  'exploration',
  'planning',
  'implementation',
  'debugging',
  'review',
  'testing',
  'writing',
  'general',
]);
const DIFFICULTIES: ReadonlySet<string> = new Set(['light', 'standard', 'heavy', 'unknown']);
const BASES: ReadonlySet<string> = new Set(['agent', 'heuristic', 'unknown']);
const PROPOSAL_SOURCES: ReadonlySet<string> = new Set(['agent', 'heuristic']);
const DECISION_SOURCES: ReadonlySet<string> = new Set([
  'step_lock',
  'run_role_lock',
  'agent',
  'heuristic',
  'role_default',
  'session_default',
  'kind_default',
  'legacy',
]);
const ADJUSTMENTS: ReadonlySet<string> = new Set([
  'none',
  'unknown_model',
  'disconnected',
  'cooldown',
  'budget',
  'unsupported_effort',
]);

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOnlyKeys = ({
  value,
  keys,
}: {
  readonly value: Readonly<Record<string, unknown>>;
  readonly keys: ReadonlyArray<string>;
}): boolean => Object.keys(value).every((key) => keys.includes(key));

const isBoundedReason = (value: unknown): value is string =>
  typeof value === 'string' && Array.from(value).length <= 240;

const isPick = (value: unknown): value is WorkflowModelPick => {
  if (!isRecord(value) || !hasOnlyKeys({ value, keys: ['provider', 'model', 'effort'] })) {
    return false;
  }
  return (
    typeof value['provider'] === 'string' &&
    PROVIDERS.has(value['provider']) &&
    typeof value['model'] === 'string' &&
    value['model'].length > 0 &&
    (value['effort'] === null ||
      (typeof value['effort'] === 'string' && EFFORTS.has(value['effort'])))
  );
};

export const isWorkflowTaskProfile = (value: unknown): value is WorkflowTaskProfile => {
  if (!isRecord(value) || !hasOnlyKeys({ value, keys: ['taskType', 'difficulty', 'basis'] })) {
    return false;
  }
  return (
    typeof value['taskType'] === 'string' &&
    TASK_TYPES.has(value['taskType']) &&
    typeof value['difficulty'] === 'string' &&
    DIFFICULTIES.has(value['difficulty']) &&
    typeof value['basis'] === 'string' &&
    BASES.has(value['basis'])
  );
};

export const isWorkflowRoutingProposal = (value: unknown): value is WorkflowRoutingProposal => {
  if (!isRecord(value) || !hasOnlyKeys({ value, keys: ['pick', 'reason', 'source', 'profile'] })) {
    return false;
  }
  return (
    isPick(value['pick']) &&
    isBoundedReason(value['reason']) &&
    typeof value['source'] === 'string' &&
    PROPOSAL_SOURCES.has(value['source']) &&
    isWorkflowTaskProfile(value['profile'])
  );
};

export const isWorkflowRoutingLock = (value: unknown): value is WorkflowRoutingLock => {
  if (!isRecord(value) || !hasOnlyKeys({ value, keys: ['version', 'pick', 'origin'] })) {
    return false;
  }
  return (
    value['version'] === 1 &&
    isPick(value['pick']) &&
    (value['origin'] === 'user' || value['origin'] === 'legacy')
  );
};

export const isWorkflowRoutingDecision = (value: unknown): value is WorkflowRoutingDecision => {
  if (
    !isRecord(value) ||
    !hasOnlyKeys({
      value,
      keys: ['version', 'proposal', 'selected', 'source', 'reason', 'adjustment', 'executed'],
    })
  ) {
    return false;
  }
  return (
    value['version'] === 1 &&
    (value['proposal'] === null || isWorkflowRoutingProposal(value['proposal'])) &&
    isPick(value['selected']) &&
    typeof value['source'] === 'string' &&
    DECISION_SOURCES.has(value['source']) &&
    isBoundedReason(value['reason']) &&
    typeof value['adjustment'] === 'string' &&
    ADJUSTMENTS.has(value['adjustment']) &&
    (value['executed'] === null || isPick(value['executed']))
  );
};

type ParseParams<T> = {
  readonly value: string | null | undefined;
  readonly isValid: (candidate: unknown) => candidate is T;
  readonly field: string;
};

export const parseRoutingJson = <T>({ value, isValid, field }: ParseParams<T>): T | null => {
  if (value === null || value === undefined) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(`Invalid ${field}`);
  }
  if (!isValid(parsed)) {
    throw new Error(`Invalid ${field}`);
  }
  return parsed;
};

type StringifyParams<T> = {
  readonly value: T | null;
  readonly isValid: (candidate: unknown) => candidate is T;
  readonly field: string;
};

export const stringifyRoutingJson = <T>({
  value,
  isValid,
  field,
}: StringifyParams<T>): string | null => {
  if (value === null) {
    return null;
  }
  if (!isValid(value)) {
    throw new Error(`Invalid ${field}`);
  }
  return JSON.stringify(value);
};

export type ParsedWorkflowRouting = Readonly<{
  routingLock: WorkflowRoutingLock | null;
  routingDecision: WorkflowRoutingDecision | null;
  taskProfile: WorkflowTaskProfile | null;
}>;

export const parseWorkflowRouting = ({
  routingLock,
  routingDecision,
  taskProfile,
}: {
  readonly routingLock: string | null;
  readonly routingDecision: string | null;
  readonly taskProfile: string | null;
}): ParsedWorkflowRouting => ({
  routingLock: parseRoutingJson({
    value: routingLock,
    isValid: isWorkflowRoutingLock,
    field: 'routing lock',
  }),
  routingDecision: parseRoutingJson({
    value: routingDecision,
    isValid: isWorkflowRoutingDecision,
    field: 'routing decision',
  }),
  taskProfile: parseRoutingJson({
    value: taskProfile,
    isValid: isWorkflowTaskProfile,
    field: 'task profile',
  }),
});

type LegacyPickParams = {
  readonly provider: string | null;
  readonly model: string | null;
  readonly effort: string | null;
};

const legacyPick = ({ provider, model, effort }: LegacyPickParams): WorkflowModelPick | null => {
  const candidate = { provider, model, effort };
  if (!isPick(candidate)) {
    return null;
  }
  return candidate;
};

export const legacyStepRoutingLock = ({
  provider,
  model,
  effort,
}: LegacyPickParams): WorkflowRoutingLock | null => {
  const pick = legacyPick({ provider, model, effort });
  if (pick === null) {
    return null;
  }
  return { version: 1, pick, origin: 'legacy' };
};

export const legacyAgentRoutingDecision = ({
  provider,
  model,
  effort,
}: LegacyPickParams): WorkflowRoutingDecision | null => {
  const pick = legacyPick({ provider, model, effort });
  if (pick === null) {
    return null;
  }
  return {
    version: 1,
    proposal: null,
    selected: pick,
    source: 'legacy',
    reason: 'Existing selection',
    adjustment: 'none',
    executed: null,
  };
};
