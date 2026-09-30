import type { MountId, Session, SessionId } from '@goodboy/types';
import { ReportedError } from '../notifications/reportedError';
import type { SessionRepo } from '../worktrees/resolveSessionRepo';
import { getSessionRepo } from '../worktrees/getSessionRepo';
import type { GetFn } from './types';
import { sessionById } from '../sessions/sessionIndex';

export const PR_WRITE_NO_PULL_REQUEST = 'This session has no pull request to update';
export const PR_WRITE_NO_SESSION = 'This session no longer exists';
export const PR_WRITE_NO_WORKSPACE = "This session's workspace is missing";
export const PR_WRITE_NO_REPO = 'No repository is mounted for this pull request';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly prNumber: number | undefined;
  readonly mountId?: MountId;
  readonly failureTitle: (params: { readonly prNumber: number | null }) => string;
};

export type PrWriteContext = {
  readonly num: number;
  readonly session: Session;
  readonly repo: SessionRepo;
};

export const prWriteContext = ({
  get,
  sessionId,
  prNumber,
  mountId,
  failureTitle,
}: Params): PrWriteContext => {
  const num = prNumber ?? get().sessionGithub[sessionId]?.pr?.number ?? null;
  const session = sessionById(get().sessions, sessionId) ?? null;
  const fail = (message: string): never => {
    void get()
      .reportError({
        title: failureTitle({ prNumber: num }),
        error: new Error(message),
        sessionId,
        ...(session === null ? {} : { workspaceId: session.workspaceId }),
      })
      .catch(() => undefined);
    throw new ReportedError(message);
  };
  if (session === null) {
    return fail(PR_WRITE_NO_SESSION);
  }
  if (num === null) {
    return fail(PR_WRITE_NO_PULL_REQUEST);
  }
  const workspace = get().workspaces.find((candidate) => candidate.id === session.workspaceId);
  if (workspace === undefined) {
    return fail(PR_WRITE_NO_WORKSPACE);
  }
  const repo = getSessionRepo({ get, sessionId, ...(mountId === undefined ? {} : { mountId }) });
  if (repo === null) {
    return fail(PR_WRITE_NO_REPO);
  }
  return { num, session, repo };
};
