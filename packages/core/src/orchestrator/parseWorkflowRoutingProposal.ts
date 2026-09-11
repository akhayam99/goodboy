import type {
  ModelEffort,
  ProviderId,
  WorkflowRoutingProposal,
  WorkflowTaskDifficulty,
  WorkflowTaskProfile,
  WorkflowTaskType,
} from '@goodboy/types';
import { PROVIDER_IDS } from '@goodboy/types';
import { MODEL_CATALOGS } from '../providers/catalogs';

export const WORKFLOW_ROUTING_REASON_LIMIT = 240;

export type WorkflowRoutingRequestedIdentity = Readonly<{
  provider: string | null;
  model: string | null;
  effort: string | null;
}>;

export type WorkflowRoutingProposalParseOutcome =
  | Readonly<{ kind: 'missing'; profile: WorkflowTaskProfile }>
  | Readonly<{ kind: 'valid'; proposal: WorkflowRoutingProposal }>
  | Readonly<{
      kind: 'invalid';
      requested: WorkflowRoutingRequestedIdentity;
      reason: string;
      profile: WorkflowTaskProfile;
    }>;

export type WorkflowRoutingWireFields = Readonly<{
  provider?: unknown;
  model?: unknown;
  effort?: unknown;
  taskType?: unknown;
  difficulty?: unknown;
  modelReason?: unknown;
}>;

export const MODEL_EFFORTS = [
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
] satisfies ReadonlyArray<ModelEffort>;

const TASK_TYPES = [
  'exploration',
  'planning',
  'implementation',
  'debugging',
  'review',
  'testing',
  'writing',
  'general',
] satisfies ReadonlyArray<WorkflowTaskType>;

const DIFFICULTIES = [
  'light',
  'standard',
  'heavy',
  'unknown',
] satisfies ReadonlyArray<WorkflowTaskDifficulty>;

const optionalString = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  return trimmed;
};

export const cappedRoutingReason = (value: string): string => {
  const characters = Array.from(value);
  if (characters.length <= WORKFLOW_ROUTING_REASON_LIMIT) {
    return value;
  }
  return characters.slice(0, WORKFLOW_ROUTING_REASON_LIMIT).join('');
};

type ProfileParams = {
  readonly fields: WorkflowRoutingWireFields;
};

const taskProfile = ({ fields }: ProfileParams): WorkflowTaskProfile => {
  const requestedTaskType = optionalString(fields.taskType);
  const requestedDifficulty = optionalString(fields.difficulty);
  const taskType = TASK_TYPES.find((candidate) => candidate === requestedTaskType);
  const difficulty = DIFFICULTIES.find((candidate) => candidate === requestedDifficulty);
  if (taskType === undefined && difficulty === undefined) {
    return { taskType: 'general', difficulty: 'unknown', basis: 'unknown' };
  }
  return {
    taskType: taskType ?? 'general',
    difficulty: difficulty ?? 'unknown',
    basis: 'agent',
  };
};

type Params = {
  readonly fields: WorkflowRoutingWireFields;
  readonly emittingProvider: ProviderId;
};

export const parseWorkflowRoutingProposal = ({
  fields,
  emittingProvider,
}: Params): WorkflowRoutingProposalParseOutcome => {
  const profile = taskProfile({ fields });
  const requestedProvider = optionalString(fields.provider);
  const requestedModel = optionalString(fields.model);
  const requestedEffort = optionalString(fields.effort);
  const requested = {
    provider: requestedProvider,
    model: requestedModel,
    effort: requestedEffort,
  } satisfies WorkflowRoutingRequestedIdentity;
  const hasRoutingField =
    fields.provider !== undefined || fields.model !== undefined || fields.effort !== undefined;
  if (hasRoutingField === false) {
    return { kind: 'missing', profile };
  }
  if (requestedModel === null) {
    return {
      kind: 'invalid',
      requested,
      reason: 'The emitted routing selection has no model.',
      profile,
    };
  }
  const namedProvider = PROVIDER_IDS.find((candidate) => candidate === requestedProvider);
  const selectedProvider = requestedProvider === null ? emittingProvider : namedProvider;
  if (selectedProvider === undefined) {
    return {
      kind: 'invalid',
      requested,
      reason: `Unknown routing provider: ${requestedProvider}.`,
      profile,
    };
  }
  const model = MODEL_CATALOGS[selectedProvider].find(
    (candidate) => candidate.key === requestedModel,
  );
  if (model === undefined) {
    return {
      kind: 'invalid',
      requested,
      reason: `Unknown routing model: ${selectedProvider}/${requestedModel}.`,
      profile,
    };
  }
  const effort = MODEL_EFFORTS.find((candidate) => candidate === requestedEffort);
  if (requestedEffort !== null && effort === undefined) {
    return {
      kind: 'invalid',
      requested,
      reason: `Unknown routing effort: ${requestedEffort}.`,
      profile,
    };
  }
  const modelReason = optionalString(fields.modelReason);
  return {
    kind: 'valid',
    proposal: {
      pick: {
        provider: selectedProvider,
        model: model.key,
        effort: effort ?? null,
      },
      reason: cappedRoutingReason(modelReason ?? 'The agent emitted this routing selection.'),
      source: 'agent',
      profile,
    },
  };
};
