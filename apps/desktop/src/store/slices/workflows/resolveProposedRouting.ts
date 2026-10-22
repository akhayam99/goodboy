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
} from '@goodboy/core';
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
  stepLock?: WorkflowRoutingLock | null;
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
  stepLock = null,
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
  });
  const resolution = resolveWorkflowRouting({
    agentLock: null,
    stepLock,
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
