import type { ResolvePublication, SessionId } from '@goodboy/types';
import {
  worktreeIsAncestor,
  worktreeRemoteHead,
  worktreeStatus,
} from '../../../features/worktree/worktree';
import { pushSessionBranch } from '../github/pushSessionBranch';
import { remoteCarriesWorkError, remoteMovedError } from './remoteMovedError';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly publication: ResolvePublication;
};

const shortOf = ({ sha }: { readonly sha: string | null }): string =>
  sha === null ? 'nothing' : sha.slice(0, 7);

export const verifiedPush = async ({
  get,
  sessionId,
  publication,
}: Params): Promise<string | null> => {
  const target = publication.mountTarget;
  if (target === null) {
    return 'the branch mount this publication was built against is unknown, so nothing was pushed';
  }
  const worktreePath = target.worktreePath;
  const branch = publication.branch;
  const before = await worktreeRemoteHead({ worktreePath, branch }).catch(() => null);
  const isReadable = before !== null || publication.remoteHead === null;
  if (!isReadable) {
    return `the state of ${branch} on the remote could not be read, so nothing was pushed`;
  }
  if (before !== publication.remoteHead) {
    return remoteMovedError({ branch, remote: before, reviewed: publication.remoteHead });
  }
  const isFastForward =
    before === null ||
    (await worktreeIsAncestor({ worktreePath, sha: before, head: publication.localHead }).catch(
      () => false,
    ));
  if (!isFastForward) {
    return remoteCarriesWorkError({ branch, local: publication.localHead });
  }
  const status = await worktreeStatus({ worktreePath }).catch(() => null);
  const isExact = status?.head != null && status.head !== publication.localHead;
  const push = await pushSessionBranch({
    get,
    sessionId,
    mountId: target.mountId,
    expectedWorktreePath: target.worktreePath,
    ...(isExact && { sha: publication.localHead }),
  });
  if (!push.ok) {
    return push.error;
  }
  const after = await worktreeRemoteHead({ worktreePath, branch }).catch(() => null);
  if (after === null) {
    return `the state of ${branch} on the remote could not be read, so the push of ${shortOf({ sha: publication.localHead })} stays unverified`;
  }
  if (after !== publication.localHead) {
    return remoteMovedError({ branch, remote: after, reviewed: publication.localHead });
  }
  return null;
};
