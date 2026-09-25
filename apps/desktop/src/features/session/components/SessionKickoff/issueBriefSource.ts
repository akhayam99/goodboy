import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';
import type { IssueBriefSource } from '../../../../store/slices/issue-briefs/types';

type Params = {
  readonly candidate: IssueCandidate;
};

export const issueBriefSource = ({ candidate }: Params): IssueBriefSource => ({
  provider: candidate.provider,
  externalId: candidate.externalId,
  identifier: candidate.identifier,
  title: candidate.title,
  body: candidate.body,
  url: candidate.url,
  noun: candidate.provider === 'slack' ? 'thread' : 'issue',
});
