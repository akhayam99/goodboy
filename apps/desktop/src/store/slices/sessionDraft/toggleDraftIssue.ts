import type { IssueCandidate } from '../../../features/integrations/fetchIssueCandidates';
import { draftIssueKey } from './draftIssueKey';
import { MAX_DRAFT_ISSUES } from './maxDraftIssues';

type Params = {
  readonly picked: ReadonlyArray<IssueCandidate>;
  readonly candidate: IssueCandidate;
};

type Result = {
  readonly picked: ReadonlyArray<IssueCandidate>;
  readonly isRefused: boolean;
};

export const toggleDraftIssue = ({ picked, candidate }: Params): Result => {
  const key = draftIssueKey({ candidate });
  if (picked.some((entry) => draftIssueKey({ candidate: entry }) === key)) {
    return {
      picked: picked.filter((entry) => draftIssueKey({ candidate: entry }) !== key),
      isRefused: false,
    };
  }
  if (picked.length >= MAX_DRAFT_ISSUES) {
    return { picked, isRefused: true };
  }
  return { picked: [...picked, candidate], isRefused: false };
};
