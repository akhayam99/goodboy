import type { SessionId } from '@goodboy/types';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly fromBranch: string | null;
  readonly toBranch: string;
};

export const announceSessionBranchChange = async ({
  get,
  sessionId,
  fromBranch,
  toBranch,
}: Params): Promise<void> => {
  if (fromBranch === toBranch) {
    return;
  }
  const state = get();
  const session = state.sessions.find((candidate) => candidate.id === sessionId);
  const carried = (state.sessionExternalTasks[sessionId] ?? []).filter(
    (task) => task.branch != null && task.branch !== toBranch,
  );
  const outgoing = fromBranch == null ? 'the previous branch' : fromBranch;
  const body =
    carried.length === 0
      ? `Pull requests now read from ${toBranch}.`
      : `${carried.length} linked ${carried.length === 1 ? 'issue stays' : 'issues stay'} on ${outgoing} and moved to the work history. Pull requests now read from ${toBranch}.`;
  await get().emitNotification('branch-changed', 'info', `Branch is now ${toBranch}`, body, {
    sessionId,
    ...(session != null ? { workspaceId: session.workspaceId } : {}),
  });
};
