import type { ObjectTarget } from './types';

type Params = {
  readonly target: ObjectTarget;
};

export const actionRunKeyOf = ({ target }: Params): string | null => {
  if (target.kind === 'pullRequest') {
    return `pullRequest:${target.sessionId}:${target.mountId ?? ''}`;
  }
  if (target.kind === 'diff') {
    return `diff:${target.sessionId}:${target.worktreePath}`;
  }
  return null;
};
