import type { GitlabReviewTransport } from '@goodboy/core';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import {
  gitlabListMrDiscussions,
  gitlabMrDiffRefs,
  gitlabReplyToMrDiscussion,
  gitlabResolveMrDiscussion,
} from './client';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly projectId?: ProjectId;
  readonly host: string;
  readonly projectPath: string;
  readonly mrIid: number;
};

export const gitlabReviewTransport = ({
  workspaceId,
  projectId,
  host,
  projectPath,
  mrIid,
}: Params): GitlabReviewTransport => {
  const target = {
    workspaceId,
    host,
    projectPath,
    mrIid,
    ...(projectId === undefined ? {} : { projectId }),
  };
  return {
    listDiscussions: () => gitlabListMrDiscussions(target),
    replyToDiscussion: ({ discussionId, body }) =>
      gitlabReplyToMrDiscussion({ ...target, discussionId, body }),
    resolveDiscussion: ({ discussionId, resolved }) =>
      gitlabResolveMrDiscussion({ ...target, discussionId, resolved }),
    readHeadSha: async () =>
      (await gitlabMrDiffRefs(workspaceId, host, projectPath, mrIid, projectId)).headSha,
  };
};
