import type { IssueCandidate } from '../integrations/fetchIssueCandidates';

type Params = {
  readonly candidate: IssueCandidate;
};

export const issueGoalOf = ({ candidate }: Params): string => {
  const goal = candidate.goal.trim();
  return goal === '' ? candidate.title : goal;
};
