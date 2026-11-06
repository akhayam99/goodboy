import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../store';
import { sessionPlace } from '../../store/slices/navigation/place';

type Params = {
  readonly sessionId: SessionId;
  readonly issueNumber: number;
};

export const openGithubIssue = ({ sessionId, issueNumber }: Params): void => {
  useAppStore.getState().navigate({
    to: sessionPlace({
      sessionId,
      lens: 'github_issue',
      target: { kind: 'github-issue', issueNumber },
    }),
  });
};
