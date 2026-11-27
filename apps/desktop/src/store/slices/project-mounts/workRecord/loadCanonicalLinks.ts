import { listMountPullRequestLinks } from '@goodboy/db';
import type { MountPullRequestLink, SessionId, SessionMountView } from '@goodboy/types';
import { tauriDatabase } from '../../../../shared/lib/db';
import { canonicalPullRequestLinkOf } from './canonicalPullRequestLinkOf';

type Params = {
  readonly sessionId: SessionId;
  readonly views: ReadonlyArray<SessionMountView>;
};

export const loadCanonicalLinks = async ({
  sessionId,
  views,
}: Params): Promise<ReadonlyArray<MountPullRequestLink>> => {
  const linkLists = await Promise.all(
    views.map((view) =>
      listMountPullRequestLinks({ db: tauriDatabase, sessionId, mountId: view.id }),
    ),
  );
  return linkLists.flatMap((links) => {
    const canonical = canonicalPullRequestLinkOf({ links });
    return canonical === null ? [] : [canonical];
  });
};
