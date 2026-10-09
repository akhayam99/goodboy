import { gitlabPullRequestPort, type PullRequestPort } from '@goodboy/core';
import type { GitlabIntegrationBinding, MountId, SessionId } from '@goodboy/types';
import type { GetFn } from '../../../store/slice-types';
import type { MountGitlabMrState } from '../../../store/slices/gitlab-mr/state';
import { selectActiveMountId } from '../../../store/slices/project-mounts/selectors';
import { sessionMountTargets } from '../../../store/slices/project-mounts/mountRequests';
import { sessionById } from '../../../store/slices/sessions/sessionIndex';
import { gitlabPullRequestTransport } from './gitlabPullRequestTransport';

type Params = Readonly<{
  get: GetFn;
  sessionId: SessionId;
  mountId?: MountId;
  prNumber?: number;
}>;

const hasMergeRequest = (
  entry: MountGitlabMrState | undefined,
  prNumber: number | undefined,
): entry is MountGitlabMrState =>
  entry !== undefined &&
  entry.mr !== null &&
  entry.host !== null &&
  entry.projectPath !== null &&
  (prNumber === undefined || entry.mr.iid === prNumber);

export const gitlabPortOf = ({
  get,
  sessionId,
  mountId,
  prNumber,
}: Params): PullRequestPort | null => {
  const state = get();
  const session = sessionById(state.sessions, sessionId);
  if (session === undefined) {
    return null;
  }
  const hasCredential = (state.workspaceIntegrations?.[session.workspaceId] ?? []).some(
    (binding): binding is GitlabIntegrationBinding => binding.provider === 'gitlab',
  );
  if (!hasCredential) {
    return null;
  }
  const mountIds = [
    mountId ?? selectActiveMountId({ state, sessionId }),
    ...sessionMountTargets({ state, sessionId }).map((target) => target.id),
  ].filter((id): id is MountId => id !== null);
  const entry = mountIds
    .map((id) => state.mountGitlabMr?.[id])
    .find((candidate) => hasMergeRequest(candidate, prNumber));
  if (entry === undefined || entry.mr === null) {
    return null;
  }
  return gitlabPullRequestPort({
    transport: gitlabPullRequestTransport({
      workspaceId: session.workspaceId,
      projectId: entry.projectId,
      host: entry.host ?? '',
      projectPath: entry.projectPath ?? '',
      mrIid: entry.mr.iid,
    }),
    mrUrl: entry.mr.webUrl,
  });
};
