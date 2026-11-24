import {
  hintedRoutingOutcome,
  parseWorkflowRoutingProposal,
  type WorkflowRoutingProposalParseOutcome,
  type WorkflowRoutingWireFields,
} from '@goodboy/core/orchestrator';
import { buildCandidates, stepSizeOf, type CandidateInputs } from '@goodboy/core/providers';
import type { AgentRole, ProviderId, WorkflowRoutingDecision } from '@goodboy/types';
import { candidateDecision } from './candidateDecision';
import { movedDecision } from './movedDecision';
import { writerFamilyOf, type RoutedPick } from './writerFamilyOf';

type Params = {
  readonly inputs: CandidateInputs;
  readonly role: AgentRole;
  readonly fields: WorkflowRoutingWireFields;
  readonly isModelPickEnabled: boolean;
  readonly promptText: string;
  readonly emittingProvider: ProviderId;
  readonly earlier: ReadonlyArray<RoutedPick>;
};

export type OrchestratedStepRouting = Readonly<{
  routingProposal: WorkflowRoutingProposalParseOutcome;
  decision: WorkflowRoutingDecision | null;
}>;

type WireParams = Pick<Params, 'fields' | 'isModelPickEnabled'>;

const wireFieldsOf = ({ fields, isModelPickEnabled }: WireParams): WorkflowRoutingWireFields =>
  isModelPickEnabled
    ? fields
    : { taskType: fields.taskType, difficulty: fields.difficulty, modelReason: fields.modelReason };

export const resolveOrchestratedStepRouting = ({
  inputs,
  role,
  fields,
  isModelPickEnabled,
  promptText,
  emittingProvider,
  earlier,
}: Params): OrchestratedStepRouting => {
  const wire = wireFieldsOf({ fields, isModelPickEnabled });
  const routingProposal = hintedRoutingOutcome({
    outcome: parseWorkflowRoutingProposal({ fields: wire, emittingProvider }),
    promptText,
  });
  const effortless =
    routingProposal.kind === 'invalid' && routingProposal.requested.effort !== null
      ? parseWorkflowRoutingProposal({ fields: { ...wire, effort: undefined }, emittingProvider })
      : null;
  const pickWithoutEffort = effortless?.kind === 'valid' ? effortless.proposal : null;
  const profile =
    routingProposal.kind === 'valid' ? routingProposal.proposal.profile : routingProposal.profile;
  const list = buildCandidates({
    inputs,
    need: {
      role,
      size: stepSizeOf({ difficulty: profile.difficulty }),
      scope: 'step',
      writerFamily: writerFamilyOf({ role, earlier }),
    },
  });
  const routed = candidateDecision({
    list,
    proposal: routingProposal.kind === 'valid' ? routingProposal.proposal : pickWithoutEffort,
  });
  if (routed.kind === 'none') {
    return { routingProposal, decision: null };
  }
  if (routingProposal.kind !== 'invalid') {
    return { routingProposal, decision: routed.decision };
  }
  if (pickWithoutEffort !== null) {
    const { decision } = routed;
    return {
      routingProposal,
      decision:
        decision.adjustment === 'none'
          ? { ...decision, adjustment: 'unsupported_effort' }
          : decision,
    };
  }
  const { requested } = routingProposal;
  return {
    routingProposal,
    decision: movedDecision({
      list,
      candidate: routed.candidate,
      cause: requested.model === null ? 'not-listed' : 'unknown-model',
      asked:
        requested.provider == null && requested.model == null
          ? null
          : { provider: requested.provider ?? '', model: requested.model ?? '' },
      proposal: null,
    }),
  };
};
