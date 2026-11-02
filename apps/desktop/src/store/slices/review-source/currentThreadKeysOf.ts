import type { SessionId } from '@goodboy/types';
import { bitbucketMountOf, gitlabMountOf } from '../mount-request/requestOf';
import type { AppState } from '../../types';
import { sessionMountTargets } from '../project-mounts/mountRequests';
import { bitbucketThreadsKey, openBitbucketPullRequestsOf } from './reviewSourceEntries';

type Params = {
  readonly state: AppState;
  readonly sessionId: SessionId;
};

export const currentThreadKeysOf = ({ state, sessionId }: Params): ReadonlySet<string> => {
  const keys = new Set<string>();
  for (const target of sessionMountTargets({ state, sessionId })) {
    const gitlab = gitlabMountOf({ state, mountId: target.id });
    if (
      gitlab !== undefined &&
      gitlab.mr !== null &&
      gitlab.host !== null &&
      gitlab.projectPath !== null
    ) {
      keys.add(gitlab.mr.webUrl);
    }
    const bitbucket = bitbucketMountOf({ state, mountId: target.id });
    if (bitbucket !== undefined && bitbucket.repo !== null) {
      for (const pr of openBitbucketPullRequestsOf({ bitbucket })) {
        keys.add(bitbucketThreadsKey({ mountId: target.id, pr }));
      }
    }
  }
  return keys;
};
