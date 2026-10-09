import { checksBridge, type GhBridgeArgs } from './checks.runner';

export const BITBUCKET_REMOTE = 'git@bitbucket.org:harborline/payments-api.git';

export const BITBUCKET_PR_URL = 'https://bitbucket.org/harborline/payments-api/pull-requests/42';

export type BitbucketBridgeArgs = GhBridgeArgs & {
  readonly sourceBranch?: string;
  readonly title?: string | null;
  readonly description?: string | null;
  readonly reviewerUuids?: ReadonlyArray<string> | null;
  readonly pullRequestId?: number;
};

type Status = 'SUCCESSFUL' | 'FAILED';

type BridgeState = {
  title: string;
  statuses: ReadonlyArray<Status>;
  branch: string;
  writes: Array<{ readonly command: string; readonly args: BitbucketBridgeArgs }>;
};

const NADIA = {
  uuid: '{nadia-uuid}',
  accountId: null,
  nickname: 'nadia-p',
  displayName: 'Nadia Petrova',
  avatarUrl: null,
};

const INITIAL_TITLE = 'Stop retried webhooks posting a second credit';

const state: BridgeState = {
  title: INITIAL_TITLE,
  statuses: ['FAILED'],
  branch: 'hl/fix-duplicate-credit',
  writes: [],
};

export const resetBitbucketBridge = ({
  branch,
  statuses,
}: {
  readonly branch: string;
  readonly statuses: ReadonlyArray<Status>;
}): void => {
  state.title = INITIAL_TITLE;
  state.statuses = statuses;
  state.branch = branch;
  state.writes = [];
};

export const bitbucketWrites = (): ReadonlyArray<{
  readonly command: string;
  readonly args: BitbucketBridgeArgs;
}> => state.writes;

const pullRequest = () => ({
  id: 42,
  title: state.title,
  description: 'Key the guard on the event id.',
  state: 'OPEN',
  createdOn: '2026-09-26T08:00:00+00:00',
  updatedOn: '2026-10-06T09:30:00+00:00',
  sourceBranch: state.branch,
  sourceCommit: '6c20f48a9e1',
  destinationBranch: 'main',
  destinationCommit: null,
  author: NADIA,
  reviewers: [],
  participants: [
    {
      user: {
        uuid: '{kenji-uuid}',
        accountId: null,
        nickname: 'kenji-w',
        displayName: 'Kenji Watanabe',
        avatarUrl: null,
      },
      role: 'REVIEWER',
      approved: true,
      state: 'approved',
    },
  ],
  closeSourceBranch: false,
  mergeCommit: null,
  commentCount: 0,
  taskCount: 0,
  webUrl: BITBUCKET_PR_URL,
});

const statusRows = () =>
  state.statuses.map((status, index) => ({
    key: `PIPELINE-${index}`,
    name: index === 0 ? 'unit tests' : `check ${index}`,
    state: status,
    url: null,
    description: null,
    refname: state.branch,
    createdOn: '2026-10-06T09:00:00+00:00',
    updatedOn: '2026-10-06T09:02:00+00:00',
  }));

const MOUNT_LINKS = /FROM mount_pr_links/;

export const bitbucketPageBridge = (
  command: string,
  payload?: BitbucketBridgeArgs,
): Promise<unknown> => {
  if (command === 'db_select' && MOUNT_LINKS.test(payload?.sql ?? '')) {
    return Promise.resolve([]);
  }
  switch (command) {
    case 'worktree_remote_url':
      return Promise.resolve(BITBUCKET_REMOTE);
    case 'bitbucket_pull_request_for_branch':
    case 'bitbucket_get_pull_request':
      return Promise.resolve(pullRequest());
    case 'bitbucket_list_pull_request_statuses':
      return Promise.resolve(statusRows());
    case 'bitbucket_list_pull_request_comments':
    case 'bitbucket_list_pull_request_commits':
    case 'bitbucket_list_pull_requests':
      return Promise.resolve([]);
    case 'bitbucket_pull_request_diff':
      return Promise.resolve('');
    case 'bitbucket_update_pull_request':
      state.writes.push({ command, args: payload ?? {} });
      if (typeof payload?.title === 'string') {
        state.title = payload.title;
      }
      return Promise.resolve(pullRequest());
    default:
      return checksBridge(command, payload);
  }
};
