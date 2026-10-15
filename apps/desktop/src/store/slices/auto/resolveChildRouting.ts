import {
  isAutoChildProvider,
  orchestratorModelPool,
  type WorkflowRoutingResolution,
} from '@goodboy/core';
import { PROVIDER_IDS, type ProviderId } from '@goodboy/types';
import { autoChildPool } from '../../../features/auto/autoChildPool';
import { workflowAvailabilitySnapshot } from '../../../features/workflows/workflowAvailabilitySnapshot';
import type { AppStore } from '../../store';
import { selectResolvedSettings } from '../overrides/selectResolvedSettings';
import { workspacePolicyAvailability } from '../providerLimits/workspacePolicyAvailability';
import { sessionById } from '../sessions/sessionIndex';
import { selectHiddenModels } from '../settings/selectHiddenModels';
import { resolveProposedRouting } from '../workflows/resolveProposedRouting';
import type { RoutingOutcome, RoutingProposalFate, RoutingRequest } from './ports';

export type ResolveChildRoutingParams = Readonly<{
  state: AppStore;
  request: RoutingRequest;
  nowMs: number;
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

type FateParams = {
  readonly decision: Extract<WorkflowRoutingResolution, { kind: 'ready' }>['decision'];
};

const fateOf = ({ decision }: FateParams): RoutingProposalFate => {
  if (decision.proposal === null) {
    return 'none';
  }
  if (decision.source !== 'agent') {
    return 'replaced';
  }
  return decision.adjustment === 'none' ? 'kept' : 'adjusted';
};

export const resolveChildRouting = ({
  state,
  request,
  nowMs,
}: ResolveChildRoutingParams): RoutingOutcome => {
  const session = sessionById(state.sessions, request.sessionId);
  if (session === undefined) {
    return BLOCKED_NO_SESSION;
  }
  const hidden = selectHiddenModels({ state });
  const workspacePolicy = workspacePolicyAvailability({ state, sessionId: request.sessionId });
  const pool = autoChildPool({
    sessions: state.sessions,
    sessionId: request.sessionId,
    policy: workspacePolicy.policy,
  });
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
  });
  const { resolution } = resolveProposedRouting({
    state,
    sessionId: request.sessionId,
    session,
    role: request.role,
    fields: request.fields,
    promptText: request.promptText,
    emittingProvider: 'anthropic',
    defaultProvider: providerOf({
      value: session.providerOverride ?? session.providerPreference.defaultProvider,
    }),
    modelMenu: orchestratorModelPool({ availability, hidden }),
    roleModels: selectResolvedSettings({ state, sessionId: request.sessionId })?.roleModels ?? null,
    providerPool: pool,
    availability,
  });
  if (resolution.kind === 'blocked') {
    return { kind: 'blocked', code: 'no_provider', message: resolution.reason };
  }
  const selected = resolution.decision.selected;
  if (!isAutoChildProvider({ provider: selected.provider })) {
    return {
      kind: 'blocked',
      code: 'provider_unproven',
      message: `${selected.provider} cannot be confined to a role yet, so Auto does not hand work to it.`,
    };
  }
  return {
    kind: 'ready',
    provider: selected.provider,
    model: selected.model,
    effort: selected.effort ?? null,
    reason: resolution.decision.reason,
    proposal: fateOf({ decision: resolution.decision }),
  };
};
