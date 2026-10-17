import type { SessionId } from '@goodboy/types';
import { EMPTY_ARRAY } from '../../../../store';
import type { AppState } from '../../../../store/types';
import type { MountRowView } from '../../../../store/slices/project-mounts/mountRowModel';
import { mountReviewGithub } from '../../../../features/review/mountReviewGithub';
import { eligibleReviewThreadCount } from '../../../../features/suggestions/eligibleThreads';

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
  readonly row: MountRowView;
};

export const commentsWaitingOf = ({ state, sessionId, row }: Params): number => {
  const request = row.request;
  if (request?.provider !== 'github') {
    return 0;
  }
  const github = mountReviewGithub({ state, sessionId, mountId: row.mountId });
  if (github?.pr?.number !== request.number) {
    return 0;
  }
  return eligibleReviewThreadCount({
    github,
    rows: state.sessionResolveThreads[sessionId] ?? EMPTY_ARRAY,
  });
};
