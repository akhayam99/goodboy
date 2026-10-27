import { gitlabReviewSource } from '@goodboy/core';
import type { MountId, SessionId } from '@goodboy/types';
import { gitlabReviewTransport } from '../../../features/integrations/gitlab/gitlabReviewTransport';
import { sessionMountTargets } from '../project-mounts/mountRequests';
import { refreshSourceThreads } from './refreshSourceThreads';
import type { GetFn, SetFn } from './types';
import { sessionById } from '../sessions/sessionIndex';

type Params = {
  readonly set: SetFn;
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly isForced: boolean;
  readonly isQuiet: boolean;
};

export const refreshGitlabReviewThreads = async ({
  set,
  get,
  sessionId,
  mountId,
  isForced,
  isQuiet,
}: Params): Promise<void> => {
  const session = sessionById(get().sessions, sessionId);
  const target = sessionMountTargets({ state: get(), sessionId }).find(
    (candidate) => candidate.id === mountId,
  );
  const gitlab = get().mountGitlabMr?.[mountId];
  const mr = gitlab?.mr ?? null;
  if (
    session === undefined ||
    target === undefined ||
    gitlab === undefined ||
    mr === null ||
    gitlab.host === null ||
    gitlab.projectPath === null
  ) {
    return;
  }
  const source = gitlabReviewSource({
    transport: gitlabReviewTransport({
      workspaceId: session.workspaceId,
      projectId: target.projectId,
      host: gitlab.host,
      projectPath: gitlab.projectPath,
      mrIid: mr.iid,
    }),
    mrUrl: mr.webUrl,
  });
  await refreshSourceThreads({
    set,
    get,
    sessionId,
    mountId,
    projectId: target.projectId,
    kind: 'gitlab',
    key: mr.webUrl,
    prNumber: mr.iid,
    isForced,
    isQuiet,
    listComments: async () => (await source.listThreads()).flatMap((thread) => thread.comments),
  });
};
