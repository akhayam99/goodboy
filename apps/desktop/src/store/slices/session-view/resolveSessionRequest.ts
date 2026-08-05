import type { PullRequestState } from '@goodboy/types';
import type { GitlabMergeRequest } from '../../../features/integrations/gitlab/client';
import { mapMrToPullRequestState } from '../../../features/integrations/gitlab/mapMrToPullRequestState';

type Params = {
  readonly pr: PullRequestState | null;
  readonly mr: GitlabMergeRequest | null;
};

export type SessionRequest = Readonly<{
  pr: PullRequestState | null;
  requestLabel: string;
}>;

export const resolveSessionRequest = ({ pr, mr }: Params): SessionRequest => {
  if (pr !== null) {
    return { pr, requestLabel: `PR #${pr.number}` };
  }
  const mapped = mapMrToPullRequestState({ mr });
  if (mapped !== null) {
    return { pr: mapped, requestLabel: `MR !${mapped.number}` };
  }
  return { pr: null, requestLabel: '' };
};
