import {
  bestCandidate,
  checkPick,
  clampEffortForModel,
  type Candidate,
  type CandidateList,
} from '@goodboy/core/providers';
import { cappedRoutingReason } from '@goodboy/core/orchestrator';
import type { ProviderId, WorkflowRoutingDecision, WorkflowRoutingProposal } from '@goodboy/types';
import { movedDecision } from './movedDecision';
import { stepRoutingReason } from './stepRoutingReason';

export type CandidateDecision =
  | Readonly<{ kind: 'ready'; decision: WorkflowRoutingDecision; candidate: Candidate }>
  | Readonly<{ kind: 'none' }>;

type DecisionParams = {
  readonly candidate: Candidate;
  readonly proposal: WorkflowRoutingProposal | null;
  readonly source: WorkflowRoutingDecision['source'];
  readonly reason: string;
  readonly adjustment: WorkflowRoutingDecision['adjustment'];
};

const readyOf = ({
  candidate,
  proposal,
  source,
  reason,
  adjustment,
}: DecisionParams): CandidateDecision => ({
  kind: 'ready',
  candidate,
  decision: {
    version: 1,
    proposal,
    selected: { provider: candidate.provider, model: candidate.model, effort: candidate.effort },
    source,
    reason,
    adjustment,
    executed: null,
  },
});

type Params = {
  readonly list: CandidateList;
  readonly proposal: WorkflowRoutingProposal | null;
  readonly batch?: ReadonlyArray<ProviderId>;
};

export const candidateDecision = ({ list, proposal, batch = [] }: Params): CandidateDecision => {
  const ruleSource = list.isPinned ? 'role_default' : 'kind_default';
  if (proposal === null) {
    const best = bestCandidate({ list, batch });
    if (best === null) {
      return { kind: 'none' };
    }
    return readyOf({
      candidate: best,
      proposal: null,
      source: ruleSource,
      reason: stepRoutingReason({ why: { kind: 'rule', candidate: best, list } }),
      adjustment: 'none',
    });
  }
  const checked = checkPick({ list, pick: { ...proposal.pick, effort: null }, batch });
  if (checked.kind === 'refused') {
    return { kind: 'none' };
  }
  if (checked.kind === 'kept') {
    const asked = proposal.pick.effort;
    const effort =
      asked === null
        ? checked.candidate.effort
        : (clampEffortForModel({
            model: checked.candidate.model,
            effort: asked,
            provider: checked.candidate.provider,
          }) ?? checked.candidate.effort);
    return readyOf({
      candidate: { ...checked.candidate, effort },
      proposal,
      source: proposal.source,
      reason: cappedRoutingReason(proposal.reason),
      adjustment: asked === null || asked === effort ? 'none' : 'unsupported_effort',
    });
  }
  return {
    kind: 'ready',
    candidate: checked.candidate,
    decision: movedDecision({
      list,
      candidate: checked.candidate,
      cause: checked.cause,
      asked: proposal.pick,
      proposal,
    }),
  };
};
