import type { MountId, ProjectId, PullRequestState, SessionId } from '@goodboy/types';
import type { GitlabMergeRequest } from '../../../features/integrations/gitlab/client';
import { isOpenNote } from '../../../features/resolve/notes/noteThread';
import type { AppState } from '../../types';
import { sessionMountTargets } from '../project-mounts/mountRequests';
import { openReviewThreadIds } from '../resolve/openReviewThreadIds';
import { LOCAL_SOURCE_KEY, type ReviewSourceEntry } from './types';

export const LOCAL_SOURCE_LABEL = 'Notes on this machine';

type State = Pick<
  AppState,
  | 'sessions'
  | 'projects'
  | 'sessionProjectMounts'
  | 'sessionMounts'
  | 'sessionActiveProject'
  | 'sessionGithub'
  | 'sessionGitlabMr'
  | 'mountGithub'
  | 'mountGitlabMr'
  | 'diffComments'
  | 'reviewSourceThreads'
>;

type Params = {
  readonly state: State;
  readonly sessionId: SessionId;
};

const OPEN_PR_STATES: ReadonlySet<PullRequestState['state']> = new Set([
  'draft',
  'open',
  'approved',
  'queued',
]);

const ENDED_MR_STATES: ReadonlySet<string> = new Set(['merged', 'closed']);

export const githubSourceKey = ({
  mountId,
  number,
}: {
  readonly mountId: MountId | null;
  readonly number: number;
}): string => `github:${mountId ?? 'session'}:${number}`;

export const gitlabSourceKey = ({
  mountId,
  number,
}: {
  readonly mountId: MountId | null;
  readonly number: number;
}): string => `gitlab:${mountId ?? 'session'}:${number}`;

const REPO_NAME = /^https?:\/\/[^/]+\/(?:.+\/)?([^/]+)\/(?:-\/merge_requests|pull)\/\d+/;

const repoNameOf = ({ url }: { readonly url: string }): string =>
  REPO_NAME.exec(url)?.[1] ?? 'Request';

const projectNameOf = ({
  state,
  projectId,
  fallback,
}: {
  readonly state: State;
  readonly projectId: ProjectId | null;
  readonly fallback: string;
}): string =>
  (projectId === null
    ? undefined
    : (state.projects ?? []).find((candidate) => candidate.id === projectId)?.name) ?? fallback;

const githubEntry = ({
  state,
  mountId,
  projectId,
  pr,
  openCount,
}: {
  readonly state: State;
  readonly mountId: MountId | null;
  readonly projectId: ProjectId | null;
  readonly pr: PullRequestState;
  readonly openCount: number | null;
}): ReviewSourceEntry => ({
  key: githubSourceKey({ mountId, number: pr.number }),
  kind: 'github',
  mountId,
  projectId,
  number: pr.number,
  label: `${projectNameOf({ state, projectId, fallback: repoNameOf({ url: pr.url }) })} #${pr.number}`,
  url: pr.url,
  openCount,
});

const gitlabEntry = ({
  state,
  sessionId,
  mountId,
  projectId,
  mr,
}: {
  readonly state: State;
  readonly sessionId: SessionId;
  readonly mountId: MountId | null;
  readonly projectId: ProjectId | null;
  readonly mr: GitlabMergeRequest;
}): ReviewSourceEntry => {
  const threads = state.reviewSourceThreads?.[sessionId]?.[mr.webUrl];
  return {
    key: gitlabSourceKey({ mountId, number: mr.iid }),
    kind: 'gitlab',
    mountId,
    projectId,
    number: mr.iid,
    label: `${projectNameOf({ state, projectId, fallback: repoNameOf({ url: mr.webUrl }) })} !${mr.iid}`,
    url: mr.webUrl,
    openCount:
      threads === undefined ? null : openReviewThreadIds({ comments: threads.comments }).length,
  };
};

const pullRequestsOf = ({
  prs,
  displayed,
}: {
  readonly prs: ReadonlyArray<PullRequestState>;
  readonly displayed: PullRequestState | null;
}): ReadonlyArray<PullRequestState> => {
  const open = prs.filter((candidate) => OPEN_PR_STATES.has(candidate.state));
  if (displayed === null || open.some((candidate) => candidate.number === displayed.number)) {
    return open;
  }
  return [displayed, ...open];
};

export const reviewSourceEntriesOf = ({
  state,
  sessionId,
}: Params): ReadonlyArray<ReviewSourceEntry> => {
  const entries: Array<ReviewSourceEntry> = [];
  for (const target of sessionMountTargets({ state, sessionId })) {
    const github = state.mountGithub?.[target.id];
    if (github !== undefined) {
      const displayedNumber = github.pr?.number ?? null;
      for (const pr of pullRequestsOf({ prs: github.prs, displayed: github.pr })) {
        entries.push(
          githubEntry({
            state,
            mountId: target.id,
            projectId: target.projectId,
            pr,
            openCount:
              pr.number === displayedNumber && github.detail !== null
                ? openReviewThreadIds({ comments: github.detail.comments }).length
                : null,
          }),
        );
      }
    }
    const gitlab = state.mountGitlabMr?.[target.id];
    if (gitlab?.mr != null && !ENDED_MR_STATES.has(gitlab.mr.state)) {
      entries.push(
        gitlabEntry({
          state,
          sessionId,
          mountId: target.id,
          projectId: target.projectId,
          mr: gitlab.mr,
        }),
      );
    }
  }
  const projectId = state.sessionActiveProject?.[sessionId] ?? null;
  const sessionGithub = state.sessionGithub?.[sessionId];
  if (!entries.some((entry) => entry.kind === 'github') && sessionGithub?.pr != null) {
    entries.push(
      githubEntry({
        state,
        mountId: null,
        projectId,
        pr: sessionGithub.pr,
        openCount:
          sessionGithub.detail === null
            ? null
            : openReviewThreadIds({ comments: sessionGithub.detail.comments }).length,
      }),
    );
  }
  const sessionGitlab = state.sessionGitlabMr?.[sessionId];
  if (
    !entries.some((entry) => entry.kind === 'gitlab') &&
    sessionGitlab?.mr != null &&
    !ENDED_MR_STATES.has(sessionGitlab.mr.state)
  ) {
    entries.push(
      gitlabEntry({
        state,
        sessionId,
        mountId: null,
        projectId,
        mr: sessionGitlab.mr,
      }),
    );
  }
  entries.push({
    key: LOCAL_SOURCE_KEY,
    kind: 'local',
    mountId: null,
    projectId: null,
    number: null,
    label: LOCAL_SOURCE_LABEL,
    url: null,
    openCount: (state.diffComments?.[sessionId] ?? []).filter((note) => isOpenNote({ note }))
      .length,
  });
  return entries;
};
