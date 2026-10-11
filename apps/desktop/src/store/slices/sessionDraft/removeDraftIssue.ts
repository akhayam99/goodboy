import type { IssueCandidate } from '../../../features/integrations/fetchIssueCandidates';
import { draftIssueKey } from './draftIssueKey';

type Params = {
  readonly picked: ReadonlyArray<IssueCandidate>;
  readonly key: string;
};

export const removeDraftIssue = ({ picked, key }: Params): ReadonlyArray<IssueCandidate> =>
  picked.filter((entry) => draftIssueKey({ candidate: entry }) !== key);
