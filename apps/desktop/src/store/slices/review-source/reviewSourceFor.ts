import {
  githubReviewSource,
  gitlabReviewSource,
  localReviewSource,
  type ReviewSource,
} from '@goodboy/core';
import type { ResolveThread, SessionId } from '@goodboy/types';
import { tauriGhRunner } from '../../../features/github/github';
import { gitlabReviewTransport } from '../../../features/integrations/gitlab/gitlabReviewTransport';
import { sessionThreadGhOptions } from '../github/sessionThreadGhOptions';
import { sessionMountTargets } from '../project-mounts/mountRequests';
import { threadSourceKindOf } from '../resolve/resolveThreadSource';
import { activeReviewSourceOf } from './activeReviewSource';
import type { GetFn } from './types';

type Params = {
  readonly get: GetFn;
  readonly sessionId: SessionId;
  readonly row: Pick<
    ResolveThread,
    'threadId' | 'originKind' | 'sourceKind' | 'projectId' | 'prNumber'
  >;
};

export const NO_REVIEW_SOURCE = 'This comment has no source to talk to';

export const reviewSourceFor = ({ get, sessionId, row }: Params): ReviewSource => {
  const kind = threadSourceKindOf({ row });
  if (kind === 'local') {
    return localReviewSource({
      closeNote: ({ threadId }) => get().closeResolvedNote({ sessionId, threadId }),
    });
  }
  const state = get();
  const active = activeReviewSourceOf({ state, sessionId });
  if (kind === 'github') {
    const isActive = active?.kind === 'github';
    return githubReviewSource({
      runner: tauriGhRunner,
      repo: isActive ? (active.repo ?? '') : '',
      prNumber: row.prNumber ?? (isActive ? active.prNumber : 0),
      prUrl: isActive ? active.url : null,
      options: sessionThreadGhOptions({ get, sessionId }),
    });
  }
  if (kind === 'gitlab') {
    const session = state.sessions.find((candidate) => candidate.id === sessionId);
    const mountIds = new Set(sessionMountTargets({ state, sessionId }).map((target) => target.id));
    const entry = Object.values(state.mountGitlabMr ?? {}).find(
      (candidate) =>
        (mountIds.size === 0 || mountIds.has(candidate.mountId)) &&
        candidate.mr !== null &&
        candidate.host !== null &&
        candidate.projectPath !== null &&
        (row.prNumber === null || candidate.mr.iid === row.prNumber) &&
        (row.projectId === null || candidate.projectId === row.projectId),
    );
    if (session === undefined || entry === undefined || entry.mr === null) {
      throw new Error(NO_REVIEW_SOURCE);
    }
    return gitlabReviewSource({
      transport: gitlabReviewTransport({
        workspaceId: session.workspaceId,
        projectId: entry.projectId,
        host: entry.host ?? '',
        projectPath: entry.projectPath ?? '',
        mrIid: entry.mr.iid,
      }),
      mrUrl: entry.mr.webUrl,
    });
  }
  throw new Error(NO_REVIEW_SOURCE);
};
