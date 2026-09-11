import { clampTitle } from '../../../../store/slices/sessions/titleLimit';
import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';

export type IssueAdoption = {
  readonly identifier: string;
  readonly title: string | null;
  readonly goal: string | null;
};

type Params = {
  readonly candidate: IssueCandidate;
  readonly currentTitle: string;
  readonly currentGoal: string;
};

export const proposeIssueAdoption = ({
  candidate,
  currentTitle,
  currentGoal,
}: Params): IssueAdoption => {
  const title = clampTitle(`[${candidate.identifier}] ${candidate.title}`);
  const goal = candidate.goal.trim();
  const hasGoalAlready = currentGoal.trim() !== '';

  return {
    identifier: candidate.identifier,
    title: title === '' || title === currentTitle.trim() ? null : title,
    goal: goal === '' || hasGoalAlready ? null : goal,
  };
};

type EmptyParams = {
  readonly adoption: IssueAdoption;
};

export const hasNothingToAdopt = ({ adoption }: EmptyParams): boolean =>
  adoption.title === null && adoption.goal === null;
