import type {
  CatalogModel,
  ModelEffort,
  ProviderId,
  WorkflowModelPick,
  WorkflowRoutingDecision,
  WorkflowRoutingLock,
  WorkflowRoutingProposal,
  WorkflowTaskProfile,
} from '@goodboy/types';
import { PROVIDER_IDS } from '@goodboy/types';
import { MODEL_CATALOGS } from '../providers/catalogs';
import { getProviderModelPrice } from '../providers/model-price';
import { resolveModelArgs } from '../providers/resolveModelArgs';
import { resolveStoredModelSelection } from '../providers/resolveStoredModelSelection';
import { workflowModelProfile } from '../providers/workflowModelProfiles';
import type { WorkflowRoutingProposalParseOutcome } from './parseWorkflowRoutingProposal';
import { cappedRoutingReason } from './parseWorkflowRoutingProposal';
import type { WorkflowModelCandidate } from './recommendWorkflowModel';
import { recommendWorkflowModel } from './recommendWorkflowModel';
import type {
  WorkflowRoutingAvailabilitySnapshot,
  WorkflowRoutingUnavailableCause,
} from './workflowRoutingAvailability';
import { workflowRoutingAvailability } from './workflowRoutingAvailability';

export type WorkflowRoutingResolution =
  | Readonly<{ kind: 'ready'; decision: WorkflowRoutingDecision }>
  | Readonly<{
      kind: 'blocked';
      cause: 'unavailable_lock' | 'no_available_model' | 'budget';
      reason: string;
    }>;

type Params = {
  readonly agentLock: WorkflowRoutingLock | null;
  readonly stepLock: WorkflowRoutingLock | null;
  readonly runRoleLock: WorkflowModelPick | null;
  readonly proposal: WorkflowRoutingProposalParseOutcome;
  readonly roleDefault: WorkflowModelPick | null;
  readonly sessionDefault: WorkflowModelPick | null;
  readonly kindDefault: WorkflowModelPick | null;
  readonly availability: WorkflowRoutingAvailabilitySnapshot;
  readonly contextEstimate: number | null;
};

type ModelParams = {
  readonly provider: ProviderId;
  readonly model: string;
};

const catalogModel = ({ provider, model }: ModelParams): CatalogModel | undefined =>
  MODEL_CATALOGS[provider].find((candidate) => candidate.key === model);

const supportedEfforts = ({ provider, model }: ModelParams): ReadonlyArray<ModelEffort> => {
  const found = catalogModel({ provider, model });
  if (found === undefined) {
    return [];
  }
  if (found.provider === 'cursor') {
    return [
      ...new Set(found.combos.flatMap((combo) => (combo.effort === null ? [] : [combo.effort]))),
    ];
  }
  return found.efforts;
};

const defaultEffort = ({ provider, model }: ModelParams): ModelEffort | null => {
  const found = catalogModel({ provider, model });
  if (found === undefined) {
    return null;
  }
  if (found.provider === 'cursor') {
    const combo = found.combos[0];
    if (combo === undefined) {
      return null;
    }
    return combo.effort;
  }
  if (found.efforts.length === 0) {
    return null;
  }
  return found.defaultEffort;
};

type PickParams = {
  readonly pick: WorkflowModelPick;
};

type EffortNormalization = Readonly<{
  effort: ModelEffort | null;
  wasAdjusted: boolean;
}>;

const normalizeAutomaticEffort = ({ pick }: PickParams): EffortNormalization => {
  const efforts = supportedEfforts(pick);
  if (efforts.length === 0) {
    return { effort: null, wasAdjusted: pick.effort !== null };
  }
  if (pick.effort === null) {
    return { effort: defaultEffort(pick), wasAdjusted: false };
  }
  if (efforts.includes(pick.effort) === true) {
    return { effort: pick.effort, wasAdjusted: false };
  }
  const stored = resolveStoredModelSelection({
    provider: pick.provider,
    id: pick.model,
    effort: pick.effort,
  });
  const resolved = resolveModelArgs({ provider: pick.provider, selection: stored.selection });
  const clamped = resolved.clamped;
  if (clamped === undefined) {
    return { effort: defaultEffort(pick), wasAdjusted: true };
  }
  return { effort: clamped.applied, wasAdjusted: true };
};

const normalizeLockedEffort = ({ pick }: PickParams): ModelEffort | null | 'rejected' => {
  const efforts = supportedEfforts(pick);
  if (efforts.length === 0) {
    if (pick.effort !== null) {
      return 'rejected';
    }
    return null;
  }
  if (pick.effort === null) {
    return defaultEffort(pick);
  }
  if (efforts.includes(pick.effort) === false) {
    return 'rejected';
  }
  return pick.effort;
};

type AvailabilityParams = {
  readonly availability: WorkflowRoutingAvailabilitySnapshot;
};

const availableCandidates = ({
  availability,
}: AvailabilityParams): ReadonlyArray<WorkflowModelCandidate> => {
  const candidates: Array<WorkflowModelCandidate> = [];
  for (const provider of PROVIDER_IDS) {
    for (const model of MODEL_CATALOGS[provider]) {
      const effort = defaultEffort({ provider, model: model.key });
      const status = workflowRoutingAvailability({
        pick: { provider, model: model.key, effort },
        snapshot: availability,
      });
      if (status.kind !== 'available') {
        continue;
      }
      candidates.push({
        provider,
        model: model.key,
        effort,
        contextWindow: model.contextWindow,
        profile: workflowModelProfile({ provider, model: model.key }),
        price: getProviderModelPrice({ provider, model: model.key }),
      });
    }
  }
  return candidates;
};

const budgetCause = ({ availability }: AvailabilityParams): 'budget' | 'no_available_model' => {
  if (availability.isSessionBudgetBlocked === true || availability.isRunBudgetBlocked === true) {
    return 'budget';
  }
  return 'no_available_model';
};

const CAUSE_SENTENCE: Readonly<Record<WorkflowRoutingUnavailableCause, string>> = {
  unknown_model: 'The emitted selection named a model this build does not know.',
  disconnected: 'The emitted selection needs a provider that is not connected.',
  cooldown: 'The emitted selection is in provider cooldown.',
  budget: 'The emitted selection is blocked by a hard budget cap.',
};

type DecisionParams = {
  readonly pick: WorkflowModelPick;
  readonly source: WorkflowRoutingDecision['source'];
  readonly reason: string;
  readonly proposal: WorkflowRoutingProposal | null;
  readonly adjustment: WorkflowRoutingDecision['adjustment'];
};

const readyDecision = ({
  pick,
  source,
  reason,
  proposal,
  adjustment,
}: DecisionParams): WorkflowRoutingResolution => ({
  kind: 'ready',
  decision: {
    version: 1,
    proposal,
    selected: pick,
    source,
    reason: cappedRoutingReason(reason),
    adjustment,
    executed: null,
  },
});

type LockParams = {
  readonly pick: WorkflowModelPick;
  readonly source: 'step_lock' | 'run_role_lock';
  readonly label: string;
  readonly proposal: WorkflowRoutingProposal | null;
  readonly availability: WorkflowRoutingAvailabilitySnapshot;
};

const resolveLock = ({
  pick,
  source,
  label,
  proposal,
  availability,
}: LockParams): WorkflowRoutingResolution => {
  const status = workflowRoutingAvailability({ pick, snapshot: availability });
  if (status.kind === 'unavailable') {
    return {
      kind: 'blocked',
      cause: 'unavailable_lock',
      reason: cappedRoutingReason(
        `${label} holds ${pick.provider}/${pick.model}, which is unavailable (${status.cause}). Reset the lock or pick another model.`,
      ),
    };
  }
  const effort = normalizeLockedEffort({ pick });
  if (effort === 'rejected') {
    return {
      kind: 'blocked',
      cause: 'unavailable_lock',
      reason: cappedRoutingReason(
        `${label} asks for effort ${String(pick.effort)}, which ${pick.provider}/${pick.model} does not support. Change the locked effort.`,
      ),
    };
  }
  return readyDecision({
    pick: { ...pick, effort },
    source,
    reason: `${label} selected ${pick.provider}/${pick.model}.`,
    proposal,
    adjustment: 'none',
  });
};

type RecoveryParams = {
  readonly cause: WorkflowRoutingUnavailableCause;
  readonly profile: WorkflowTaskProfile;
  readonly proposal: WorkflowRoutingProposal | null;
  readonly availability: WorkflowRoutingAvailabilitySnapshot;
  readonly contextEstimate: number | null;
};

const resolveRecovery = ({
  cause,
  profile,
  proposal,
  availability,
  contextEstimate,
}: RecoveryParams): WorkflowRoutingResolution => {
  const recommendation = recommendWorkflowModel({
    candidates: availableCandidates({ availability }),
    profile,
    contextEstimate,
  });
  if (recommendation === null) {
    return {
      kind: 'blocked',
      cause: budgetCause({ availability }),
      reason: 'No available catalog model can run this node.',
    };
  }
  return readyDecision({
    pick: recommendation.pick,
    source: 'heuristic',
    reason: `${CAUSE_SENTENCE[cause]} ${recommendation.reason}`,
    proposal,
    adjustment: cause,
  });
};

type FallbackParams = {
  readonly roleDefault: WorkflowModelPick | null;
  readonly sessionDefault: WorkflowModelPick | null;
  readonly kindDefault: WorkflowModelPick | null;
  readonly availability: WorkflowRoutingAvailabilitySnapshot;
};

type FallbackRung = Readonly<{
  pick: WorkflowModelPick | null;
  source: 'role_default' | 'session_default' | 'kind_default';
  label: string;
}>;

const resolveFallback = ({
  roleDefault,
  sessionDefault,
  kindDefault,
  availability,
}: FallbackParams): WorkflowRoutingResolution => {
  const rungs: ReadonlyArray<FallbackRung> = [
    { pick: roleDefault, source: 'role_default', label: 'The configured role default' },
    { pick: sessionDefault, source: 'session_default', label: 'The session default' },
    { pick: kindDefault, source: 'kind_default', label: 'The static kind default' },
  ];
  let configured = 0;
  for (const rung of rungs) {
    const pick = rung.pick;
    if (pick === null) {
      continue;
    }
    configured += 1;
    const status = workflowRoutingAvailability({ pick, snapshot: availability });
    if (status.kind !== 'available') {
      continue;
    }
    const normalized = normalizeAutomaticEffort({ pick });
    return readyDecision({
      pick: { ...pick, effort: normalized.effort },
      source: rung.source,
      reason: `${rung.label} selected ${pick.provider}/${pick.model}.`,
      proposal: null,
      adjustment: normalized.wasAdjusted === true ? 'unsupported_effort' : 'none',
    });
  }
  if (configured === 0) {
    return {
      kind: 'blocked',
      cause: 'no_available_model',
      reason: 'This node has no emitted pick and no configured routing default.',
    };
  }
  return {
    kind: 'blocked',
    cause: budgetCause({ availability }),
    reason: 'Every configured routing default for this node is unavailable.',
  };
};

export const resolveWorkflowRouting = ({
  agentLock,
  stepLock,
  runRoleLock,
  proposal,
  roleDefault,
  sessionDefault,
  kindDefault,
  availability,
  contextEstimate,
}: Params): WorkflowRoutingResolution => {
  const emitted = proposal.kind === 'valid' ? proposal.proposal : null;
  const profile = proposal.kind === 'valid' ? proposal.proposal.profile : proposal.profile;
  const lock = agentLock ?? stepLock;
  if (lock !== null) {
    return resolveLock({
      pick: lock.pick,
      source: 'step_lock',
      label: 'This node lock',
      proposal: emitted,
      availability,
    });
  }
  if (runRoleLock !== null) {
    return resolveLock({
      pick: runRoleLock,
      source: 'run_role_lock',
      label: 'The run role lock',
      proposal: emitted,
      availability,
    });
  }
  if (proposal.kind === 'valid') {
    const pick = proposal.proposal.pick;
    const status = workflowRoutingAvailability({ pick, snapshot: availability });
    if (status.kind === 'available') {
      const normalized = normalizeAutomaticEffort({ pick });
      return readyDecision({
        pick: { ...pick, effort: normalized.effort },
        source: proposal.proposal.source,
        reason: proposal.proposal.reason,
        proposal: emitted,
        adjustment: normalized.wasAdjusted === true ? 'unsupported_effort' : 'none',
      });
    }
    return resolveRecovery({
      cause: status.cause,
      profile,
      proposal: emitted,
      availability,
      contextEstimate,
    });
  }
  if (proposal.kind === 'invalid') {
    return resolveRecovery({
      cause: 'unknown_model',
      profile,
      proposal: null,
      availability,
      contextEstimate,
    });
  }
  return resolveFallback({ roleDefault, sessionDefault, kindDefault, availability });
};
