import type { PullRequestPort } from '@goodboy/core';
import type { MountId, SessionId } from '@goodboy/types';
import { githubPortOf } from '../../../features/integrations/github/githubPortOf';
import type { GetFn } from '../../slice-types';
import { activeReviewSourceOf } from './activeReviewSource';
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
  gitlab: noPortOf,
  bitbucket: noPortOf,
} as const satisfies Readonly<Record<RemoteKind, PortBuilder>>;

export const pullRequestPortFor = (params: PortBuilderParams): PullRequestPort | null => {
  const active = activeReviewSourceOf({ state: params.get(), sessionId: params.sessionId });
  return PORT_BUILDERS[active?.kind ?? 'github'](params);
};
