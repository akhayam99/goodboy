import type { PullRequestPort } from '@goodboy/core';
import type { MountId, PullRequestHost, SessionId } from '@goodboy/types';
import { bitbucketPortOf } from '../../../features/integrations/bitbucket/bitbucketPortOf';
import { githubPortOf } from '../../../features/integrations/github/githubPortOf';
import { gitlabPortOf } from '../../../features/integrations/gitlab/gitlabPortOf';
import type { GetFn } from '../../slice-types';
import { requestHostOf } from './requestHostOf';

export type PortBuilderParams = Readonly<{
  get: GetFn;
  sessionId: SessionId;
  mountId?: MountId;
  prNumber?: number;
}>;

type PortBuilder = (params: PortBuilderParams) => PullRequestPort | null;

const PORT_BUILDERS = {
  github: githubPortOf,
  gitlab: gitlabPortOf,
  bitbucket: bitbucketPortOf,
} as const satisfies Readonly<Record<PullRequestHost, PortBuilder>>;

export const pullRequestPortFor = (params: PortBuilderParams): PullRequestPort | null =>
  PORT_BUILDERS[
    requestHostOf({
      state: params.get(),
      sessionId: params.sessionId,
      ...(params.mountId === undefined ? {} : { mountId: params.mountId }),
    })
  ](params);
