import type { MountId, SessionId } from '@goodboy/types';
import type {
  BitbucketPullRequest,
  BitbucketRepo,
} from '../../../features/integrations/bitbucket/client';
import type { AppState } from '../../types';
import { sessionMountTargets } from '../project-mounts/mountRequests';
import { selectActiveMountId } from '../project-mounts/selectors';
import type { MountBitbucketPrState } from './state';

export type BitbucketRequest = Readonly<{
  mountId: MountId;
  repo: BitbucketRepo;
  pr: BitbucketPullRequest;
  entry: MountBitbucketPrState;
}>;

type State = Pick<
  AppState,
  | 'mountBitbucketPr'
  | 'sessions'
  | 'sessionMounts'
  | 'sessionProjectMounts'
  | 'sessionActiveMount'
  | 'sessionActiveProject'
>;

type Params = Readonly<{
  state: State;
  sessionId: SessionId;
  mountId?: MountId;
  prNumber?: number;
}>;

const requestOf = ({
  entry,
  prNumber,
}: {
  readonly entry: MountBitbucketPrState | undefined;
  readonly prNumber: number | undefined;
}): BitbucketRequest | null => {
  if (entry === undefined || entry.repo === null) {
    return null;
  }
  const candidates = [...(entry.pr === null ? [] : [entry.pr]), ...entry.prs];
  const pr =
    prNumber === undefined
      ? candidates[0]
      : candidates.find((candidate) => candidate.id === prNumber);
  return pr === undefined ? null : { mountId: entry.mountId, repo: entry.repo, pr, entry };
};

export const selectBitbucketRequest = ({
  state,
  sessionId,
  mountId,
  prNumber,
}: Params): BitbucketRequest | null => {
  const byMount = state.mountBitbucketPr ?? {};
  if (mountId !== undefined) {
    return requestOf({ entry: byMount[mountId], prNumber });
  }
  const activeId = selectActiveMountId({ state, sessionId });
  const ordered = [
    ...(activeId === null ? [] : [activeId]),
    ...sessionMountTargets({ state, sessionId }).map((target) => target.id),
  ];
  for (const id of ordered) {
    const found = requestOf({ entry: byMount[id], prNumber });
    if (found !== null) {
      return found;
    }
  }
  return null;
};
