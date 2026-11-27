import type {
  AgentRole,
  ProviderId,
  SessionId,
  WorkflowRoutingLock,
  WorkflowRoutingProposal,
  WorkflowRules,
  WorkflowRunId,
  WorkflowTaskProfile,
} from '@goodboy/types';
import {
  hintedRoutingOutcome,
  resolveWorkflowRouting,
  type WorkflowMissingProposalPolicy,
  type WorkflowRoutingProposalParseOutcome,
  type WorkflowRoutingResolution,
} from '@goodboy/core/orchestrator';
import {
  bestCandidate,
  buildCandidates,
  stepSizeOf,
  type CandidateInputs,
} from '@goodboy/core/providers';
import { workflowAvailabilitySnapshot } from '../../../features/workflows/workflowAvailabilitySnapshot';
import { workspacePolicyAvailability } from '../providerLimits/workspacePolicyAvailability';
import { runProviderPool } from '../../../features/workflows/runProviderPool';
import type { AppStore } from '../../store';
import { selectCandidateInputs } from '../../runtime/models/selectCandidateInputs';
import { candidateDecision } from './candidateDecision';
import { movedDecision } from './movedDecision';
import { providerCauseOf } from './providerCauseOf';
import { rolePicks } from './rolePicks';
import { selectBlockedModels } from '../providers/selectBlockedModels';

const UNKNOWN_PROFILE: WorkflowTaskProfile = {
  taskType: 'general',
  difficulty: 'unknown',
  basis: 'unknown',
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
  readonly batch?: ReadonlyArray<ProviderId>;
};

type CandidateParams = Pick<Params, 'state' | 'sessionId' | 'role'> & {
  readonly outcome: WorkflowRoutingProposalParseOutcome;
  readonly profile: WorkflowTaskProfile;
  readonly providerPool: ReadonlyArray<ProviderId> | null;
  readonly batch: ReadonlyArray<ProviderId>;
  readonly rules: WorkflowRules | null;
};

const candidateResolution = ({
  state,
  sessionId,
  role,
  outcome,
  profile,
  providerPool,
  batch,
  rules,
}: CandidateParams): WorkflowRoutingResolution | null => {
  const inputs: CandidateInputs = {
    ...selectCandidateInputs({ state, sessionId, nowMs: Date.now(), turns: [] }),
    rule: rules?.spreadByHeadroom === true ? 'load' : 'order',
    runProviders: providerPool,
  };
  const list = buildCandidates({
    inputs,
    need: { role, size: stepSizeOf({ difficulty: profile.difficulty }), scope: 'step' },
  });
  if (outcome.kind !== 'valid') {
    const routed = candidateDecision({ list, proposal: null, batch });
    return routed.kind === 'ready' ? { kind: 'ready', decision: routed.decision } : null;
  }
  const { proposal } = outcome;
  const cause = providerCauseOf({ list, provider: proposal.pick.provider });
  const best = cause === null ? null : bestCandidate({ list, batch });
  if (cause === null || best === null) {
    return null;
  }
  return {
    kind: 'ready',
    decision: movedDecision({ list, candidate: best, cause, asked: proposal.pick, proposal }),
  };
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
  batch = [],
}: Params): WorkflowChildRouting => {
  const session = (state.sessions ?? []).find((candidate) => candidate.id === sessionId);
  const outcome = childProposalOutcome({ proposal, promptText });
  const profile = outcome.kind === 'valid' ? outcome.proposal.profile : outcome.profile;
  const taskProfile = profile.basis === 'unknown' ? null : profile;
  const defaultProvider =
    session === undefined
      ? null
      : ((session.providerOverride ??
          session.providerPreference?.defaultProvider ??
          null) as ProviderId | null);
  const providerPool = runProviderPool({
    sessions: state.sessions ?? [],
    sessionId,
    workflowRunId,
  });
  const availability = workflowAvailabilitySnapshot({
    providers: state.providers ?? [],
    cooldowns: state.providerCooldowns ?? {},
    alerts: state.budgetAlerts ?? [],
    hidden: selectBlockedModels({ state: state }),
    sessionId,
    isRunBudgetBlocked: false,
    nowMs: Date.now(),
    ...workspacePolicyAvailability({ state, sessionId }),
    providerPool,
  });
  const onCandidates =
    childLock === null && availability.isSessionBudgetBlocked !== true
      ? candidateResolution({
          state,
          sessionId,
          role,
          outcome,
          profile,
          providerPool,
          batch,
          rules:
            session?.workflowRuns?.find((run) => run.id === workflowRunId)?.rulesSnapshot ?? null,
        })
      : null;
  if (onCandidates !== null) {
    return { resolution: onCandidates, taskProfile };
  }
  const picks = rolePicks({ state, sessionId, role, profile, providerPool });
  const resolution = resolveWorkflowRouting({
    agentLock: childLock,
    stepLock: null,
    proposal: outcome,
    roleDefault: picks.roleDefault,
    sessionDefault:
      session === undefined || session.modelOverride == null || defaultProvider === null
        ? null
        : {
            provider: defaultProvider,
            model: session.modelOverride,
            effort: session.effort ?? null,
          },
    kindDefault: picks.kindDefault,
    missingProposal,
    availability,
    contextEstimate: null,
  });
  return { resolution, taskProfile };
};
