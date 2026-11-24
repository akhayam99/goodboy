import { isAutoChildProvider } from '@goodboy/core/auto';
import { orchestratorModelPool, type WorkflowRoutingResolution } from '@goodboy/core/orchestrator';
import { readHeadroom, type HeadroomMap } from '@goodboy/core/providers';
import {
  DEFAULT_WORKFLOW_RULES,
  PROVIDER_IDS,
  type ProviderId,
  type WorkspaceId,
} from '@goodboy/types';
import { autoChildPool } from '../../../../features/auto/autoChildPool';
import { autoRoutableProviders } from '../../../../features/providers/autoRoutableProviders';
import { workflowAvailabilitySnapshot } from '../../../../features/workflows/workflowAvailabilitySnapshot';
import type { AppStore } from '../../../store';
import { selectResolvedSettings } from '../../../slices/overrides/selectResolvedSettings';
import { workspacePolicyAvailability } from '../../../slices/providerLimits/workspacePolicyAvailability';
import { sessionById } from '../../../slices/sessions/sessionIndex';
import { selectHiddenModels } from '../../../slices/settings/selectHiddenModels';
import { resolveProposedRouting } from '../../../slices/workflows/resolveProposedRouting';
import type { RoutingOutcome, RoutingProposalFate, RoutingRequest } from '../ports';
import { childRoutingRefusal } from './childRoutingRefusal';

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
  const defaultProvider = providerOf({
    value: session.providerOverride ?? session.providerPreference.defaultProvider,
  });
  const modelMenu = orchestratorModelPool({ availability, hidden });
  const { resolution } = resolveProposedRouting({
    state,
    sessionId: request.sessionId,
    session,
    role: request.role,
    fields: request.fields,
    isModelPickEnabled: false,
    promptText: request.promptText,
    emittingProvider: defaultProvider,
    defaultProvider,
    modelMenu,
    roleModels: selectResolvedSettings({ state, sessionId: request.sessionId })?.roleModels ?? null,
    providerPool: availability.connectedProviders.filter(
      (provider) =>
        !availability.coolingDownProviders.includes(provider) &&
        !availability.budgetBlockedProviders.includes(provider),
    ),
    availability,
    headroom,
    stepLock: request.stepLock ?? null,
  });
  if (resolution.kind === 'blocked') {
    return {
      kind: 'blocked',
      code: 'no_provider',
      message: childRoutingRefusal({
        role: request.role,
        connected: autoRoutableProviders({ providers: state.providers ?? [] }),
        pool,
        availability,
        menu: modelMenu,
        cooldowns: state.providerCooldowns ?? {},
        nowMs,
      }),
    };
  }
  const selected = resolution.decision.selected;
  if (!isAutoChildProvider({ provider: selected.provider, role: request.role })) {
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
