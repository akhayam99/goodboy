import {
  CANDIDATE_CAUSES,
  type Candidate,
  type CandidateCause,
  type CandidateList,
} from '@goodboy/core/providers';
import type { WorkflowRoutingDecision, WorkflowRoutingProposal } from '@goodboy/types';
import { stepRoutingReason } from './stepRoutingReason';

type Params = {
  readonly list: CandidateList;
  readonly candidate: Candidate;
  readonly cause: CandidateCause;
  readonly asked: Readonly<{ provider: string; model: string }> | null;
  readonly proposal: WorkflowRoutingProposal | null;
};

export const movedDecision = ({
  list,
  candidate,
  cause,
  asked,
  proposal,
}: Params): WorkflowRoutingDecision => ({
  version: 1,
  proposal,
  selected: { provider: candidate.provider, model: candidate.model, effort: candidate.effort },
  source: list.isPinned ? 'role_default' : 'kind_default',
  reason:
    asked === null
      ? stepRoutingReason({ why: { kind: 'rule', candidate, list } })
      : stepRoutingReason({ why: { kind: 'moved', candidate, list, cause, asked } }),
  adjustment: CANDIDATE_CAUSES[cause].adjustment,
  executed: null,
});
