import type {
  AgentRole,
  ProviderId,
  RoleModelPreferences,
  SessionId,
  WorkflowModelPick,
  WorkflowRoutingLock,
  WorkflowRoutingProposal,
  WorkflowRunId,
  WorkflowTaskProfile,
} from '@goodboy/types';
import {
  hintedRoutingOutcome,
  resolveRoleRouting,
  resolveWorkflowRouting,
  type WorkflowMissingProposalPolicy,
  type WorkflowRoutingProposalParseOutcome,
  type WorkflowRoutingResolution,
} from '@goodboy/core';
import { workflowAvailabilitySnapshot } from '../../../features/workflows/workflowAvailabilitySnapshot';
import { runProviderPool } from '../../../features/workflows/runProviderPool';
import { selectResolvedSettings } from '../overrides/selectResolvedSettings';
import type { AppStore } from '../../store';

const UNKNOWN_PROFILE: WorkflowTaskProfile = {
  taskType: 'general',
  difficulty: 'unknown',
  basis: 'unknown',
};

type ConfiguredRoleParams = {
  readonly role: AgentRole;
  readonly roleModels: RoleModelPreferences | null | undefined;
};

const configuredRolePick = ({
  role,
  roleModels,
}: ConfiguredRoleParams): WorkflowModelPick | null => {
  const routing = resolveRoleRouting({ role, prefs: roleModels });
  if (routing.isOverride === false) {
    return null;
  }
  return { provider: routing.provider, model: routing.model, effort: routing.effort };
};

type OutcomeParams = {
  readonly proposal: WorkflowRoutingProposal | null;
  readonly promptText: string;
};

const childProposalOutcome = ({
  proposal,
  promptText,
}: OutcomeParams): WorkflowRoutingProposalParseOutcome => {
  if (proposal === null) {
    return hintedRoutingOutcome({
      outcome: { kind: 'missing', profile: UNKNOWN_PROFILE },
      promptText,
    });
  }
  return hintedRoutingOutcome({ outcome: { kind: 'valid', proposal }, promptText });
};

type WorkflowChildRouting = Readonly<{
  resolution: WorkflowRoutingResolution;
  taskProfile: WorkflowTaskProfile | null;
}>;

type Params = {
  readonly state: AppStore;
  readonly sessionId: SessionId;
  readonly role: AgentRole;
  readonly childLock: WorkflowRoutingLock | null;
  readonly proposal: WorkflowRoutingProposal | null;
  readonly promptText: string;
  readonly missingProposal: WorkflowMissingProposalPolicy;
  readonly workflowRunId?: WorkflowRunId | null;
};

export const resolveWorkflowChildRouting = ({
  state,
  sessionId,
  role,
  childLock,
  proposal,
  promptText,
  missingProposal,
  workflowRunId = null,
}: Params): WorkflowChildRouting => {
  const session = (state.sessions ?? []).find((candidate) => candidate.id === sessionId);
  const outcome = childProposalOutcome({ proposal, promptText });
  const profile = outcome.kind === 'valid' ? outcome.proposal.profile : outcome.profile;
  const defaultProvider =
    session === undefined
      ? null
      : ((session.providerOverride ??
          session.providerPreference?.defaultProvider ??
          null) as ProviderId | null);
  const compiled = resolveRoleRouting({
    role,
    prefs: null,
    ...(defaultProvider !== null && { auto: { defaultProvider } }),
  });
  const resolution = resolveWorkflowRouting({
    agentLock: childLock,
    stepLock: null,
    proposal: outcome,
    roleDefault: configuredRolePick({
      role,
      roleModels: selectResolvedSettings({ state, sessionId })?.roleModels ?? null,
    }),
    sessionDefault:
      session === undefined || session.modelOverride == null || defaultProvider === null
        ? null
        : {
            provider: defaultProvider,
            model: session.modelOverride,
            effort: session.effort ?? null,
          },
    kindDefault: { provider: compiled.provider, model: compiled.model, effort: compiled.effort },
    missingProposal,
    availability: workflowAvailabilitySnapshot({
      providers: state.providers ?? [],
      cooldowns: state.providerCooldowns ?? {},
      alerts: state.budgetAlerts ?? [],
      sessionId,
      isRunBudgetBlocked: false,
      nowMs: Date.now(),
      providerPool: runProviderPool({ sessions: state.sessions ?? [], sessionId, workflowRunId }),
    }),
    contextEstimate: null,
  });
  return { resolution, taskProfile: profile.basis === 'unknown' ? null : profile };
};
