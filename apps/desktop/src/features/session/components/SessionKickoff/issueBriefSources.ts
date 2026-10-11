import type { IssueCandidate } from '../../../integrations/fetchIssueCandidates';
import type { IssueBriefSource } from '../../../../store/slices/issue-briefs/types';
import { issueBriefSource } from './issueBriefSource';

type Params = {
  readonly candidates: ReadonlyArray<IssueCandidate>;
};

export const issueBriefSources = ({ candidates }: Params): ReadonlyArray<IssueBriefSource> =>
  candidates.map((candidate) => issueBriefSource({ candidate }));
