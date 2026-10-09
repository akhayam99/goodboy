import {
  PullRequestPortError,
  type GitlabPullRequestTransport,
  type PullRequestFailureKind,
} from '@goodboy/core';
import type { ProjectId, WorkspaceId } from '@goodboy/types';
import { classifyGitlabFailure, gitlabFailureOf } from './classifyGitlabFailure';
import {
  gitlabGetMr,
  gitlabMergeMr,
  gitlabMrApprovalState,
  gitlabMrCommits,
  gitlabMrDiff,
  gitlabMrPipelineJobs,
  gitlabProjectMergeMethods,
  gitlabSearchProjectUsers,
  gitlabUpdateMr,
  gitlabUpdateMrState,
} from './client';

type Params = {
  readonly workspaceId: WorkspaceId;
  readonly projectId?: ProjectId;
  readonly host: string;
  readonly projectPath: string;
  readonly mrIid: number;
};

const PORT_KIND = {
  bad_credentials: 'denied',
  denied: 'denied',
  rate_limited: 'rate_limited',
  network: 'network',
  failed: 'failed',
} as const satisfies Readonly<
  Record<ReturnType<typeof classifyGitlabFailure>, PullRequestFailureKind>
>;

const gitlabPortErrorOf = ({ error }: { readonly error: unknown }): PullRequestPortError => {
  if (error instanceof PullRequestPortError) {
    return error;
  }
  const failure = gitlabFailureOf({ error });
  const details = failure.body.trim();
  return new PullRequestPortError({
    kind: PORT_KIND[classifyGitlabFailure(failure)],
    message: details === '' ? 'GitLab did not answer' : details,
    details,
  });
};

const guarded = async <T>(run: () => Promise<T>): Promise<T> => {
  try {
    return await run();
  } catch (error) {
    throw gitlabPortErrorOf({ error });
  }
};

export const gitlabPullRequestTransport = ({
  workspaceId,
  projectId,
  host,
  projectPath,
  mrIid,
}: Params): GitlabPullRequestTransport => {
  const project = {
    workspaceId,
    host,
    projectPath,
    ...(projectId === undefined ? {} : { projectId }),
  };
  const target = { ...project, mrIid };
  return {
    readMergeRequest: () => guarded(() => gitlabGetMr(target)),
    readCommits: () => guarded(() => gitlabMrCommits(target)),
    readChanges: () =>
      guarded(() => gitlabMrDiff(workspaceId, host, projectPath, mrIid, projectId)),
    readApprovals: () => guarded(() => gitlabMrApprovalState(target)),
    readPipelineJobs: () => guarded(() => gitlabMrPipelineJobs(target)),
    updateMergeRequest: ({ title, description, reviewerIds }) =>
      guarded(async () => {
        await gitlabUpdateMr({
          ...target,
          ...(title === undefined ? {} : { title }),
          ...(description === undefined ? {} : { description }),
          ...(reviewerIds === undefined ? {} : { reviewerIds }),
        });
      }),
    setState: ({ stateEvent }) =>
      guarded(async () => {
        await gitlabUpdateMrState({ ...target, stateEvent });
      }),
    merge: ({ method }) =>
      guarded(async () => {
        await gitlabMergeMr(workspaceId, host, projectPath, mrIid, projectId, method);
      }),
    projectMergeSettings: () => guarded(() => gitlabProjectMergeMethods(project)),
    searchUsers: ({ query }) => guarded(() => gitlabSearchProjectUsers({ ...project, query })),
  };
};
