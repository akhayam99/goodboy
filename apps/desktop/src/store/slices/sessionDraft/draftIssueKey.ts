import type { IssueCandidate } from '../../../features/integrations/fetchIssueCandidates';

type Params = {
  readonly candidate: Pick<IssueCandidate, 'provider' | 'externalId'>;
};

export const draftIssueKey = ({ candidate }: Params): string =>
  `${candidate.provider}:${candidate.externalId}`;
