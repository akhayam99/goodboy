import type { PrComment } from '@goodboy/types';

export const RESOLVE_ON_GITHUB_DEFAULT = true;

export type ResolveStepPlan = 'resolve' | 'leave_open';

type Params = {
  readonly threadId: string;
  readonly comments: ReadonlyArray<PrComment>;
  readonly shouldResolveOnGithub: boolean;
};

export const resolveStepPlan = ({
  threadId,
  comments,
  shouldResolveOnGithub,
}: Params): ResolveStepPlan => {
  if (!shouldResolveOnGithub) {
    return 'leave_open';
  }
  const canResolve = comments.find((comment) => comment.threadId === threadId)?.canResolve;
  return canResolve === false ? 'leave_open' : 'resolve';
};
