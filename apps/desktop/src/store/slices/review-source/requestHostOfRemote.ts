import type { PullRequestHost } from '@goodboy/types';
import { classifyRemoteHost } from '../../../shared/utils/remoteHost';
import { remoteHostNameOf } from '../../../shared/lib/remoteHostNameOf';

type Params = {
  readonly url: string | null;
  readonly gitlabHosts: ReadonlyArray<string>;
};

export const requestHostOfRemote = ({ url, gitlabHosts }: Params): PullRequestHost | null => {
  if (url === null) {
    return null;
  }
  const name = remoteHostNameOf({ url });
  if (name !== null && name.includes('bitbucket')) {
    return 'bitbucket';
  }
  const kind = classifyRemoteHost(url, gitlabHosts);
  if (kind === 'gitlab') {
    return 'gitlab';
  }
  if (kind === 'github') {
    return 'github';
  }
  return null;
};
