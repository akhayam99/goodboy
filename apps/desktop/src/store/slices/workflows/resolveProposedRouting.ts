import type {
  AgentRole,
  ProviderId,
  RoleModelPreferences,
  Session,
  SessionId,
  WorkflowModelPick,
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
} from '@goodboy/core';
import { rolePicks, type RolePicks } from '../workflowRouting/rolePicks';
import type { AppStore } from '../../store';

export type ResolveProposedRoutingParams = Readonly<{
  state: AppStore;
  sessionId: SessionId;
  session: Session;
  role: AgentRole;
  fields: WorkflowRoutingWireFields;
  promptText: string;
  emittingProvider: ProviderId;
  defaultProvider: ProviderId;
  modelMenu: ReadonlyArray<OrchestratorModelOption>;
  roleModels: RoleModelPreferences | null;
  providerPool: ReadonlyArray<ProviderId> | null;
  availability: WorkflowRoutingAvailabilitySnapshot;
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
};

const sessionDefaultOf = ({
  session,
  defaultProvider,
}: SessionDefaultParams): WorkflowModelPick | null =>
  session.modelOverride == null
    ? null
    : {
        provider: defaultProvider,
        model: session.modelOverride,
        effort: session.effort ?? null,
      };

export const resolveProposedRouting = ({
  state,
  sessionId,
  session,
  role,
  fields,
  promptText,
  emittingProvider,
  defaultProvider,
  modelMenu,
  roleModels,
  providerPool,
  availability,
}: ResolveProposedRoutingParams): ProposedRouting => {
  const parsedProposal = parseWorkflowRoutingProposal({ fields, emittingProvider });
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
  });
  const resolution = resolveWorkflowRouting({
    agentLock: null,
    stepLock: null,
    proposal: routingProposal,
    roleDefault: picks.roleDefault,
    sessionDefault: sessionDefaultOf({ session, defaultProvider }),
    kindDefault: picks.kindDefault,
    availability,
    contextEstimate: null,
    missingProposal: 'configured_default',
  });
  return { parsedProposal, routingProposal, picks, resolution };
};
