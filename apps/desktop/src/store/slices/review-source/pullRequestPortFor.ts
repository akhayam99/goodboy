import type { PullRequestPort } from '@goodboy/core';
import type { MountId, SessionId } from '@goodboy/types';
import { githubPortOf } from '../../../features/integrations/github/githubPortOf';
import { gitlabPortOf } from '../../../features/integrations/gitlab/gitlabPortOf';
import type { GetFn } from '../../slice-types';
import { activeReviewSourceOf } from './activeReviewSource';
import { sessionPullRequestHostOf } from './sessionPullRequestOf';
import type { ActiveReviewSource } from './types';

export type PortBuilderParams = Readonly<{
  get: GetFn;
  sessionId: SessionId;
  mountId?: MountId;
  prNumber?: number;
}>;

type PortBuilder = (params: PortBuilderParams) => PullRequestPort | null;

type RemoteKind = ActiveReviewSource['kind'];

const noPortOf: PortBuilder = () => null;

const PORT_BUILDERS = {
  github: githubPortOf,
  gitlab: gitlabPortOf,
  bitbucket: noPortOf,
} as const satisfies Readonly<Record<RemoteKind, PortBuilder>>;

export const pullRequestPortFor = (params: PortBuilderParams): PullRequestPort | null => {
  const state = params.get();
  const active = activeReviewSourceOf({ state, sessionId: params.sessionId });
  const kind = active?.kind ?? sessionPullRequestHostOf({ state, sessionId: params.sessionId });
  return PORT_BUILDERS[kind](params);
};
