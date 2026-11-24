import type {
  AgentRole,
  ProviderId,
  RoleModelPreferences,
  Session,
  SessionId,
  WorkflowModelPick,
  WorkflowRoutingLock,
} from '@goodboy/types';
import {
  hintedRoutingOutcome,
  keepProposalInRoleSet,
  parseWorkflowRoutingProposal,
  resolveWorkflowRouting,
  roleModelSetMenu,
  type OrchestratorModelOption,
  type WorkflowRoutingAvailabilitySnapshot,
  type WorkflowRoutingProposalParseOutcome,
  type WorkflowRoutingResolution,
  type WorkflowRoutingWireFields,
} from '@goodboy/core/orchestrator';
import type { HeadroomMap } from '@goodboy/core/providers';
import { rolePicks, type RolePicks } from '../workflowRouting/rolePicks';
import type { AppStore } from '../../store';

export type ResolveProposedRoutingParams = Readonly<{
  state: AppStore;
  sessionId: SessionId;
  session: Session;
  role: AgentRole;
  fields: WorkflowRoutingWireFields;
  isModelPickEnabled: boolean;
  promptText: string;
  emittingProvider: ProviderId;
  defaultProvider: ProviderId;
  modelMenu: ReadonlyArray<OrchestratorModelOption>;
  roleModels: RoleModelPreferences | null;
  providerPool: ReadonlyArray<ProviderId> | null;
  availability: WorkflowRoutingAvailabilitySnapshot;
  headroom?: HeadroomMap | null;
  stepLock?: WorkflowRoutingLock | null;
  agentLock?: WorkflowRoutingLock | null;
}>;

export type ProposedRouting = Readonly<{
  parsedProposal: WorkflowRoutingProposalParseOutcome;
  routingProposal: WorkflowRoutingProposalParseOutcome;
  picks: RolePicks;
  resolution: WorkflowRoutingResolution;
}>;

type SessionDefaultParams = {
  readonly session: Session;
  readonly defaultProvider: ProviderId;
  readonly headroom: HeadroomMap | null;
};

const isNearLimit = ({
  headroom,
  defaultProvider,
}: Pick<SessionDefaultParams, 'headroom' | 'defaultProvider'>): boolean =>
  headroom?.[defaultProvider] === 'tight' || headroom?.[defaultProvider] === 'out';

const sessionDefaultOf = ({
  session,
  defaultProvider,
  headroom,
}: SessionDefaultParams): WorkflowModelPick | null =>
  session.modelOverride == null || isNearLimit({ headroom, defaultProvider })
    ? null
    : {
        provider: defaultProvider,
        model: session.modelOverride,
        effort: session.effort ?? null,
      };

type WireParams = {
  readonly fields: WorkflowRoutingWireFields;
  readonly isModelPickEnabled: boolean;
};

const wireFieldsOf = ({ fields, isModelPickEnabled }: WireParams): WorkflowRoutingWireFields =>
  isModelPickEnabled
    ? fields
    : {
        taskType: fields.taskType,
        difficulty: fields.difficulty,
        modelReason: fields.modelReason,
      };

export const resolveProposedRouting = ({
  state,
  sessionId,
  session,
  role,
  fields,
  isModelPickEnabled,
  promptText,
  emittingProvider,
  defaultProvider,
  modelMenu,
  roleModels,
  providerPool,
  availability,
  headroom = null,
  stepLock = null,
  agentLock = null,
}: ResolveProposedRoutingParams): ProposedRouting => {
  const parsedProposal = parseWorkflowRoutingProposal({
    fields: wireFieldsOf({ fields, isModelPickEnabled }),
    emittingProvider,
  });
  const routingProposal = keepProposalInRoleSet({
    outcome: hintedRoutingOutcome({ outcome: parsedProposal, promptText }),
    setMenu: roleModelSetMenu({ menu: modelMenu, role, prefs: roleModels }),
  });
  const picks = rolePicks({
    state,
    sessionId,
    role,
    profile:
      parsedProposal.kind === 'valid' ? parsedProposal.proposal.profile : parsedProposal.profile,
    providerPool,
    headroom,
  });
  const resolution = resolveWorkflowRouting({
    agentLock,
    stepLock,
    proposal: routingProposal,
    roleDefault: picks.roleDefault,
    sessionDefault: sessionDefaultOf({ session, defaultProvider, headroom }),
    kindDefault: picks.kindDefault,
    availability,
    contextEstimate: null,
    missingProposal: 'configured_default',
    lockKind: agentLock === null ? 'node' : 'agent',
  });
  return { parsedProposal, routingProposal, picks, resolution };
};
