import { formatError } from '@goodboy/ui';
import type { MountId, SessionId } from '@goodboy/types';
import { historyTargetOf } from './historyTargetOf';
import type { GetFn, HistoryIdentity, HistoryTarget } from './types';

export const identityOf = ({ target }: { readonly target: HistoryTarget }): HistoryIdentity => ({
  worktreePath: target.worktreePath,
  branch: target.branch,
  projectId: target.projectId,
});

type ChangeParams = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly mountId: MountId;
  readonly identity: HistoryIdentity;
};

export const identityChange = ({
  get,
  sessionId,
  mountId,
  identity,
}: ChangeParams): string | null => {
  let target: HistoryTarget;
  try {
    target = historyTargetOf({ get, sessionId, mountId });
  } catch (error) {
    return `${formatError(error)} Nothing was changed.`;
  }
  const now = identityOf({ target });
  if (
    now.worktreePath === identity.worktreePath &&
    now.branch === identity.branch &&
    now.projectId === identity.projectId
  ) {
    return null;
  }
  return `This rewrite was tried on ${identity.branch}, but this place now points at ${now.branch}${now.worktreePath === identity.worktreePath ? '' : ' in another folder'}. Nothing was changed.`;
};
