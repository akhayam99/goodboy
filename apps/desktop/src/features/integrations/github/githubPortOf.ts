import { githubPullRequestPort, type PullRequestPort } from '@goodboy/core';
import type { MountId, PullRequestState, SessionId } from '@goodboy/types';
import type { GetFn } from '../../../store/slice-types';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import { getSessionRepo } from '../../../store/slices/worktrees/getSessionRepo';
import { tauriGhRunner } from './github';

type Params = Readonly<{
  get: GetFn;
  sessionId: SessionId;
  mountId?: MountId;
  prNumber?: number;
}>;

const prNamed = ({
  prs,
  number,
}: {
  readonly prs: ReadonlyArray<PullRequestState>;
  readonly number: number;
}): PullRequestState | null => prs.find((candidate) => candidate.number === number) ?? null;

export const githubPortOf = ({
  get,
  sessionId,
  mountId,
  prNumber,
}: Params): PullRequestPort | null => {
  const state = get();
  const session = sessionById(state.sessions, sessionId);
  const repo = getSessionRepo({ get, sessionId, ...(mountId === undefined ? {} : { mountId }) });
  if (session === undefined || repo === null) {
    return null;
  }
  const mountGithub = state.mountGithub?.[repo.mountId] ?? null;
  const sessionPr = state.sessionGithub?.[sessionId]?.pr ?? null;
  const number = prNumber ?? sessionPr?.number ?? null;
  if (number === null) {
    return null;
  }
  const pr =
    (sessionPr?.number === number ? sessionPr : null) ??
    (mountGithub === null ? null : prNamed({ prs: mountGithub.prs ?? [], number })) ??
    (mountGithub?.pr?.number === number ? mountGithub.pr : null);
  return githubPullRequestPort({
    runner: tauriGhRunner,
    repo: mountGithub?.repository ?? '',
    prNumber: number,
    prUrl: pr?.url ?? null,
    options: { cwd: repo.repoRoot, workspaceId: session.workspaceId, projectId: repo.projectId },
  });
};
