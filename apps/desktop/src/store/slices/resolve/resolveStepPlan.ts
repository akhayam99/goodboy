import type { PrComment } from '@goodboy/types';

export type ResolveStepPlan = 'resolve' | 'leave_open';

type Params = {
  readonly threadId: string;
  readonly comments: ReadonlyArray<PrComment>;
  readonly shouldResolveOnGithub: boolean;
  readonly canResolve?: boolean;
};

export const resolveStepPlan = ({
  threadId,
  comments,
  shouldResolveOnGithub,
  canResolve: sourceCanResolve = true,
}: Params): ResolveStepPlan => {
  if (!shouldResolveOnGithub || !sourceCanResolve) {
    return 'leave_open';
  }
  const canResolve = comments.find((comment) => comment.threadId === threadId)?.canResolve;
  return canResolve === false ? 'leave_open' : 'resolve';
};
