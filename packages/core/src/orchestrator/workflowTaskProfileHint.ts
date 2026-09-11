import type { WorkflowTaskDifficulty, WorkflowTaskProfile } from '@goodboy/types';
import { assessTurnWeight, type TurnWeight } from '../providers/turn-weight';
import type { WorkflowRoutingProposalParseOutcome } from './parseWorkflowRoutingProposal';

const HINTED_DIFFICULTY: Readonly<Record<TurnWeight, WorkflowTaskDifficulty>> = {
  light: 'light',
  heavy: 'heavy',
  unknown: 'unknown',
};

type Params = {
  readonly profile: WorkflowTaskProfile;
  readonly promptText: string;
};

export const workflowTaskProfileHint = ({ profile, promptText }: Params): WorkflowTaskProfile => {
  if (profile.basis === 'agent' && profile.difficulty !== 'unknown') {
    return profile;
  }
  const difficulty = HINTED_DIFFICULTY[assessTurnWeight(promptText)];
  if (difficulty === 'unknown') {
    return profile;
  }
  return { taskType: profile.taskType, difficulty, basis: 'heuristic' };
};

type OutcomeParams = {
  readonly outcome: WorkflowRoutingProposalParseOutcome;
  readonly promptText: string;
};

export const hintedRoutingOutcome = ({
  outcome,
  promptText,
}: OutcomeParams): WorkflowRoutingProposalParseOutcome => {
  if (outcome.kind === 'valid') {
    const profile = workflowTaskProfileHint({
      profile: outcome.proposal.profile,
      promptText,
    });
    return { kind: 'valid', proposal: { ...outcome.proposal, profile } };
  }
  const profile = workflowTaskProfileHint({ profile: outcome.profile, promptText });
  if (outcome.kind === 'missing') {
    return { kind: 'missing', profile };
  }
  return {
    kind: 'invalid',
    requested: outcome.requested,
    reason: outcome.reason,
    profile,
  };
};
