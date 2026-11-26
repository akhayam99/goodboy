import type { MountPullRequestLink, PullRequestState, SessionId } from '@goodboy/types';
import { pullRequestFromLink } from '../../../store/slices/github/mountGithub';
import type { SessionGithubState } from '../../../store/types';

type LinkEntry = {
  readonly sessionId: SessionId;
  readonly link: MountPullRequestLink;
};

type Params = {
  readonly links: ReadonlyArray<LinkEntry>;
};

type StateParams = {
  readonly pr: PullRequestState;
};

const githubStateOf = ({ pr }: StateParams): SessionGithubState => ({
  pr,
  linkedIssues: [],
  fetchedAt: null,
  failedAt: null,
  loading: false,
  error: null,
  detail: null,
  detailFetchedAt: null,
  detailLoading: false,
  detailError: null,
});

const isEnded = ({ link }: Pick<LinkEntry, 'link'>): boolean =>
  link.state === 'merged' || link.state === 'closed';

export const sessionGithubOf = ({
  links,
}: Params): Readonly<Record<SessionId, SessionGithubState>> => {
  const chosen = new Map<SessionId, PullRequestState>();
  const sorted = [
    ...links.filter((entry) => !isEnded({ link: entry.link })),
    ...links.filter((entry) => isEnded({ link: entry.link })),
  ];
  for (const entry of sorted) {
    const pr = pullRequestFromLink({ link: entry.link });
    if (pr !== null && 'checks' in pr && !chosen.has(entry.sessionId)) {
      chosen.set(entry.sessionId, pr);
    }
  }
  return Object.fromEntries(
    [...chosen].map(([sessionId, pr]) => [sessionId, githubStateOf({ pr })]),
  );
};
