import {
  listResolveQueueItems,
  listResolveThreadFacts,
  listResolveThreads,
  setResolveThreadGitState,
  setResolveThreadVerdict,
} from '@goodboy/db';
import type { PrComment, ResolveThread } from '@goodboy/types';
import {
  worktreeFetchOriginBranch,
  worktreeFixOnOrigin,
  worktreeIsAncestor,
  worktreeLocateFix,
  worktreeOriginCommitsTouching,
} from '../../../features/worktree/worktree';
import { tauriDatabase } from '../../../shared/lib/db';
import { selectActiveMount } from '../project-mounts/selectors';
import { getSessionRepo } from '../worktrees/getSessionRepo';
import {
  computeThreadGitFacts,
  isPushedThread,
  isWatchedThread,
  type ThreadGitFacts,
  type ThreadGitPorts,
} from './threadGitState';
import { viewerLoginsOf } from './viewerLogins';
import type { SessionParams, SliceParams } from './types';
import { sessionById } from '../sessions/sessionIndex';

type Params = SliceParams & SessionParams;

const EMPTY_COMMENTS: ReadonlyArray<PrComment> = [];

const ownShasOf = async ({
  sessionId,
  rows,
}: {
  readonly sessionId: Params['sessionId'];
  readonly rows: ReadonlyArray<ResolveThread>;
}): Promise<ReadonlySet<string>> => {
  const items = await listResolveQueueItems({ db: tauriDatabase, sessionId });
  return new Set([
    ...rows.flatMap((row) => row.commitShas ?? []),
    ...items.flatMap(({ item }) => (item.integratedSha === null ? [] : [item.integratedSha])),
  ]);
};

export const refreshThreadGitState = async ({ set, get, sessionId }: Params): Promise<void> => {
  const mount = selectActiveMount({ state: get(), sessionId });
  const repo = mount === null ? null : getSessionRepo({ get, sessionId, mountId: mount.mountId });
  const github = get().sessionGithub[sessionId] ?? null;
  const branch = github?.pr?.headBranch ?? repo?.branch ?? '';
  if (repo === null || branch === '') {
    return;
  }
  const rows = await listResolveThreads({ db: tauriDatabase, sessionId });
  const watched = rows.filter((row) => isWatchedThread({ row }) || isPushedThread({ row }));
  if (watched.length === 0) {
    return;
  }
  const worktreePath = repo.worktreePath;
  const workspaceId = sessionById(get().sessions, sessionId)?.workspaceId;
  const fetched = await worktreeFetchOriginBranch({
    worktreePath,
    branch,
    ...(workspaceId !== undefined && { workspaceId }),
    projectId: repo.projectId,
  }).catch(() => null);
  if (fetched === null || !fetched.fetched) {
    return;
  }
  const ports: ThreadGitPorts = {
    fixOnOrigin: ({ sha }) => worktreeFixOnOrigin({ worktreePath, branch, sha }),
    isOnLocalHead: ({ sha }) => worktreeIsAncestor({ worktreePath, sha, head: 'HEAD' }),
    locateFix: ({ sha, path }) => worktreeLocateFix({ worktreePath, sha, path }),
    commitsTouching: ({ path, line, sinceSecs }) =>
      worktreeOriginCommitsTouching({
        worktreePath,
        branch,
        path,
        startLine: line,
        endLine: line,
        sinceSecs,
      }),
  };
  const comments = github?.detail?.comments ?? EMPTY_COMMENTS;
  const viewerLogins = viewerLoginsOf({ state: get() });
  const ownShas = await ownShasOf({ sessionId, rows });
  const dismissals = get().threadFixDismissals[sessionId] ?? {};
  const computed = await Promise.all(
    watched.map(async (row): Promise<readonly [string, ThreadGitFacts]> => [
      row.threadId,
      await computeThreadGitFacts({
        row,
        comments,
        viewerLogins,
        ownShas,
        branch,
        ports,
        isDismissed: ({ sha }) => dismissals[row.threadId]?.includes(sha) === true,
      }),
    ]),
  );
  const persisted = new Map(
    (await listResolveThreadFacts({ db: tauriDatabase, sessionId })).map((facts) => [
      facts.threadId,
      facts,
    ]),
  );
  const merged: Array<readonly [string, ThreadGitFacts]> = [];
  for (const [threadId, facts] of computed) {
    const saved = persisted.get(threadId) ?? null;
    if ((saved?.gitState ?? 'local') !== facts.gitState) {
      await setResolveThreadGitState({
        db: tauriDatabase,
        sessionId,
        threadId,
        gitState: facts.gitState,
      });
    }
    const verdict = facts.gitState === 'missing' ? (saved?.verdict ?? null) : null;
    if (saved?.verdict != null && verdict === null) {
      await setResolveThreadVerdict({ db: tauriDatabase, sessionId, threadId, verdict: null });
    }
    merged.push([threadId, { ...facts, verdict }]);
  }
  set((state) => ({
    sessionThreadGit: { ...state.sessionThreadGit, [sessionId]: Object.fromEntries(merged) },
  }));
};

export const dismissThreadFix = ({
  set,
  get,
  sessionId,
  threadId,
  sha,
}: Params & { readonly threadId: string; readonly sha: string }): void => {
  const current = get().threadFixDismissals[sessionId] ?? {};
  set((state) => ({
    threadFixDismissals: {
      ...state.threadFixDismissals,
      [sessionId]: { ...current, [threadId]: [...(current[threadId] ?? []), sha] },
    },
  }));
  const facts = get().sessionThreadGit[sessionId] ?? {};
  const { [threadId]: dropped, ...rest } = facts;
  if (dropped === undefined) {
    return;
  }
  set((state) => ({
    sessionThreadGit: {
      ...state.sessionThreadGit,
      [sessionId]: {
        ...rest,
        [threadId]: { ...dropped, gitState: 'local', elsewhere: null },
      },
    },
  }));
};
