import { isAutoChildProvider } from '@goodboy/core/auto';
import {
  hintedRoutingOutcome,
  orchestratorModelPool,
  parseWorkflowRoutingProposal,
  type WorkflowRoutingAvailabilitySnapshot,
  type WorkflowRoutingProposalParseOutcome,
  type WorkflowRoutingResolution,
} from '@goodboy/core/orchestrator';
import {
  bestCandidate,
  buildCandidates,
  checkPick,
  readHeadroom,
  stepSizeOf,
  type Candidate,
  type CandidateList,
  type CheckedPick,
  type HeadroomMap,
} from '@goodboy/core/providers';
import type { ProviderAgentTurns } from '@goodboy/db';
import {
  DEFAULT_WORKFLOW_RULES,
  PROVIDER_IDS,
  type ProviderId,
  type Session,
  type WorkspaceId,
} from '@goodboy/types';
import { autoChildPool } from '../../../../features/auto/autoChildPool';
import { autoRoutableProviders } from '../../../../features/providers/autoRoutableProviders';
import { workflowAvailabilitySnapshot } from '../../../../features/workflows/workflowAvailabilitySnapshot';
import type { AppStore } from '../../../store';
import { selectResolvedSettings } from '../../../slices/overrides/selectResolvedSettings';
import { workspacePolicyAvailability } from '../../../slices/providerLimits/workspacePolicyAvailability';
import { sessionById } from '../../../slices/sessions/sessionIndex';
import { selectBlockedModels } from '../../../slices/providers/selectBlockedModels';
import { isSameModelRef } from './isSameModelRef';
import { resolveProposedRouting } from '../../../slices/workflows/resolveProposedRouting';
import { readProviderAgentTurns } from '../../models/readProviderAgentTurns';
import { selectCandidateInputs } from '../../models/selectCandidateInputs';
import type { RoutingOutcome, RoutingProposalFate, RoutingRequest } from '../ports';
import { agentLockWait } from './agentLockWait';
import { childRoutingReason } from './childRoutingReason';
import { childRoutingRefusal } from './childRoutingRefusal';

export type ResolveChildRoutingParams = Readonly<{
  state: AppStore;
  request: RoutingRequest;
  nowMs: number;
  turns?: ReadonlyArray<ProviderAgentTurns>;
}>;

const BLOCKED_NO_SESSION: RoutingOutcome = {
  kind: 'blocked',
  code: 'no_provider',
  message: 'The conversation this belongs to is not open.',
};

type ProviderOfParams = {
  readonly value: string;
};

const providerOf = ({ value }: ProviderOfParams): ProviderId =>
  PROVIDER_IDS.find((candidate) => candidate === value) ?? 'anthropic';

type ScopeParams = {
  readonly state: AppStore;
  readonly request: RoutingRequest;
  readonly session: Session;
  readonly nowMs: number;
};

type Scope = Readonly<{
  availability: WorkflowRoutingAvailabilitySnapshot;
  defaultProvider: ProviderId;
  refusal: () => RoutingOutcome;
}>;

type HeadroomParams = {
  readonly state: AppStore;
  readonly workspaceId: WorkspaceId;
  readonly nowMs: number;
};

const leadHeadroom = ({ state, workspaceId, nowMs }: HeadroomParams): HeadroomMap | null => {
  const overrides = state.workspaceOverrides?.[workspaceId];
  const isSpreadOn =
    overrides?.workflowRules?.spreadByHeadroom ?? DEFAULT_WORKFLOW_RULES.spreadByHeadroom;
  if (!isSpreadOn) {
    return null;
  }
  return readHeadroom({
    limits: state.providerLimits ?? {},
    policy: overrides?.providerPool ?? null,
    nowMs,
  }).headroom;
};

const scopeOf = ({ state, request, session, nowMs }: ScopeParams): Scope => {
  const hidden = selectBlockedModels({ state, nowMs });
  const workspacePolicy = workspacePolicyAvailability({
    state,
    sessionId: request.sessionId,
    nowMs,
  });
  const pool = autoChildPool({
    sessions: state.sessions,
    sessionId: request.sessionId,
    policy: workspacePolicy.policy,
    role: request.role,
  });
  const headroom = leadHeadroom({ state, workspaceId: session.workspaceId, nowMs });
  const availability = workflowAvailabilitySnapshot({
    providers: state.providers ?? [],
    cooldowns: state.providerCooldowns ?? {},
    alerts: state.budgetAlerts ?? [],
    hidden,
    sessionId: request.sessionId,
    isRunBudgetBlocked: false,
    nowMs,
    ...workspacePolicy,
    providerPool: pool,
    headroom,
  });
  return {
    availability,
    defaultProvider: providerOf({
      value: session.providerOverride ?? session.providerPreference.defaultProvider,
    }),
    refusal: () => ({
      kind: 'blocked',
      code: 'no_provider',
      message: childRoutingRefusal({
        role: request.role,
        connected: autoRoutableProviders({ providers: state.providers ?? [] }),
        pool,
        availability,
        menu: orchestratorModelPool({ availability, hidden }),
        cooldowns: state.providerCooldowns ?? {},
        nowMs,
      }),
    }),
  };
};

type DecisionParams = {
  readonly decision: Extract<WorkflowRoutingResolution, { kind: 'ready' }>['decision'];
  readonly isAgent: boolean;
};

const readyOfDecision = ({ decision, isAgent }: DecisionParams): RoutingOutcome => ({
  kind: 'ready',
  provider: decision.selected.provider,
  model: decision.selected.model,
  effort: decision.selected.effort ?? null,
  reason: decision.reason,
  proposal: 'none',
  source: isAgent ? 'lock' : 'pin',
  cause: null,
  candidates: [],
});

type LockedParams = ScopeParams & {
  readonly scope: Scope;
};

const resolveLocked = ({ state, request, session, nowMs, scope }: LockedParams): RoutingOutcome => {
  const agentLock =
    request.agentLock == null
      ? null
      : { version: 1 as const, pick: request.agentLock, origin: 'legacy' as const };
  const { resolution } = resolveProposedRouting({
    state,
    sessionId: request.sessionId,
    session,
    role: request.role,
    fields: request.fields,
    isModelPickEnabled: false,
    promptText: request.promptText,
    emittingProvider: scope.defaultProvider,
    defaultProvider: scope.defaultProvider,
    modelMenu: [],
    roleModels: selectResolvedSettings({ state, sessionId: request.sessionId })?.roleModels ?? null,
    providerPool: null,
    availability: scope.availability,
    stepLock: request.stepLock ?? null,
    agentLock,
  });
  if (resolution.kind === 'blocked') {
    if (agentLock === null) {
      return scope.refusal();
    }
    return {
      kind: 'blocked',
      code: 'no_provider',
      message: agentLockWait({
        pick: agentLock.pick,
        cooldowns: state.providerCooldowns ?? {},
        reason: resolution.reason,
        nowMs,
      }),
    };
  }
  return readyOfDecision({ decision: resolution.decision, isAgent: agentLock !== null });
};

type ProfileParams = {
  readonly parsed: WorkflowRoutingProposalParseOutcome;
};

const difficultyOf = ({ parsed }: ProfileParams) =>
  parsed.kind === 'valid' ? parsed.proposal.profile.difficulty : parsed.profile.difficulty;

type CheckParams = {
  readonly list: CandidateList;
  readonly parsed: Extract<WorkflowRoutingProposalParseOutcome, { kind: 'valid' }>;
};

type Checked = Readonly<{
  checked: CheckedPick;
  isEffortDropped: boolean;
}>;

type ProviderCauseParams = {
  readonly list: CandidateList;
  readonly checked: CheckedPick;
  readonly provider: ProviderId;
};

const withProviderCause = ({ list, checked, provider }: ProviderCauseParams): CheckedPick => {
  if (checked.kind !== 'moved' || checked.cause !== 'not-listed') {
    return checked;
  }
  const struck = list.rows.find((row) => row.provider === provider && row.cause !== null);
  return struck?.cause == null ? checked : { ...checked, cause: struck.cause };
};

const checkLeadPick = ({ list, parsed }: CheckParams): Checked => {
  const pick = parsed.proposal.pick;
  const checked = withProviderCause({
    list,
    checked: checkPick({ list, pick }),
    provider: pick.provider,
  });
  if (checked.kind === 'kept' || pick.effort === null) {
    return { checked, isEffortDropped: false };
  }
  const withoutEffort = checkPick({ list, pick: { ...pick, effort: null } });
  return withoutEffort.kind === 'kept'
    ? { checked: withoutEffort, isEffortDropped: true }
    : { checked, isEffortDropped: false };
};

type ReadyParams = {
  readonly candidate: Candidate;
  readonly list: CandidateList;
  readonly reason: string;
  readonly proposal: RoutingProposalFate;
  readonly source: NonNullable<Extract<RoutingOutcome, { kind: 'ready' }>['source']>;
  readonly cause: Extract<CheckedPick, { kind: 'moved' }>['cause'] | null;
};

const readyOf = ({
  candidate,
  list,
  reason,
  proposal,
  source,
  cause,
}: ReadyParams): RoutingOutcome => ({
  kind: 'ready',
  provider: candidate.provider,
  model: candidate.model,
  effort: candidate.effort,
  reason,
  proposal,
  source,
  cause,
  candidates: list.rows,
});

type InvalidParams = {
  readonly list: CandidateList;
};

const invalidPick = ({ list }: InvalidParams): CheckedPick => {
  const best = bestCandidate({ list });
  return best === null
    ? { kind: 'refused', cause: 'unknown-model' }
    : { kind: 'moved', cause: 'unknown-model', candidate: best };
};

type PickedParams = {
  readonly request: RoutingRequest;
  readonly list: CandidateList;
  readonly parsed: WorkflowRoutingProposalParseOutcome;
  readonly scope: Scope;
};

const resolvePicked = ({ request, list, parsed, scope }: PickedParams): RoutingOutcome => {
  if (parsed.kind === 'missing') {
    const best = bestCandidate({ list });
    if (best === null) {
      return scope.refusal();
    }
    return readyOf({
      candidate: best,
      list,
      reason: childRoutingReason({ why: { kind: 'rule', candidate: best, list } }),
      proposal: 'none',
      source: list.isPinned ? 'pin' : 'rule',
      cause: null,
    });
  }
  const { checked, isEffortDropped } =
    parsed.kind === 'valid'
      ? checkLeadPick({ list, parsed })
      : { checked: invalidPick({ list }), isEffortDropped: false };
  if (checked.kind === 'refused') {
    return scope.refusal();
  }
  if (checked.kind === 'kept') {
    const reason =
      typeof request.fields.modelReason === 'string' && parsed.kind === 'valid'
        ? parsed.proposal.reason
        : null;
    return readyOf({
      candidate: checked.candidate,
      list,
      reason: childRoutingReason({
        why: { kind: 'lead', candidate: checked.candidate, leadReason: reason },
      }),
      proposal: isEffortDropped ? 'adjusted' : 'kept',
      source: list.isPinned ? 'pin' : 'lead',
      cause: null,
    });
  }
  const asked =
    parsed.kind === 'valid'
      ? { provider: parsed.proposal.pick.provider, model: parsed.proposal.pick.model }
      : { provider: parsed.requested.provider ?? '', model: parsed.requested.model ?? '' };
  const isNoted =
    checked.cause === 'no-access' &&
    (request.notedNoAccess ?? []).some((noted) => isSameModelRef({ left: noted, right: asked }));
  return readyOf({
    candidate: checked.candidate,
    list,
    reason: childRoutingReason({
      why: isNoted
        ? { kind: 'rule', candidate: checked.candidate, list }
        : { kind: 'fallback', candidate: checked.candidate, list, cause: checked.cause, asked },
    }),
    proposal: 'replaced',
    source: list.isPinned ? 'pin' : 'fallback',
    cause: checked.cause,
  });
};

export const resolveChildRouting = async ({
  state,
  request,
  nowMs,
  turns,
}: ResolveChildRoutingParams): Promise<RoutingOutcome> => {
  const session = sessionById(state.sessions, request.sessionId);
  if (session === undefined) {
    return BLOCKED_NO_SESSION;
  }
  const scope = scopeOf({ state, request, session, nowMs });
  if (request.stepLock != null || request.agentLock != null) {
    return resolveLocked({ state, request, session, nowMs, scope });
  }
  if (scope.availability.isSessionBudgetBlocked === true) {
    return scope.refusal();
  }
  const parsed = hintedRoutingOutcome({
    outcome: parseWorkflowRoutingProposal({
      fields: request.fields,
      emittingProvider: scope.defaultProvider,
    }),
    promptText: request.promptText,
  });
  const list = buildCandidates({
    inputs: selectCandidateInputs({
      state,
      sessionId: request.sessionId,
      nowMs,
      turns: turns ?? (await readProviderAgentTurns({ nowMs })),
    }),
    need: {
      role: request.role,
      size: stepSizeOf({ difficulty: difficultyOf({ parsed }) }),
      scope: 'helper',
      writerFamily: request.writerFamily ?? null,
      failedStarts: request.failedStarts ?? null,
    },
  });
  const outcome = resolvePicked({ request, list, parsed, scope });
  if (
    outcome.kind === 'ready' &&
    !isAutoChildProvider({ provider: outcome.provider, role: request.role })
  ) {
    return {
      kind: 'blocked',
      code: 'provider_unproven',
      message: `${outcome.provider} cannot be confined to a role yet, so Auto does not hand work to it.`,
    };
  }
  return outcome;
};
