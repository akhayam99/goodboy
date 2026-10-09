import { checksBridge, type GhBridgeArgs } from './checks.runner';

type Mr = Record<string, unknown>;

const URL = 'https://gitlab.com/harborline/payments-api/-/merge_requests/42';

const BASE_MR: Mr = {
  id: 4201,
  iid: 42,
  projectId: 9,
  title: 'Stop retried webhooks posting a second credit',
  description: 'Key the guard on the event id.',
  state: 'opened',
  webUrl: URL,
  sourceBranch: 'hl/fix-duplicate-credit',
  targetBranch: 'main',
  draft: false,
  hasConflicts: false,
  mergeStatus: 'can_be_merged',
  detailedMergeStatus: 'mergeable',
  updatedAt: '2026-09-04T10:00:00Z',
  createdAt: '2026-09-04T08:00:00Z',
  sha: 'a41c9e2b7d3f',
  mergedAt: null,
  author: { id: 3, username: 'nadia-p', name: 'Nadia Petrova', avatarUrl: null },
  reviewers: [{ id: 7, username: 'kenji-w', name: 'Kenji Watanabe', avatarUrl: null }],
  headPipeline: { id: 9001, status: 'success', webUrl: null },
};

const APPROVALS = {
  approvalsRequired: 1,
  approvalsLeft: 0,
  userHasApproved: false,
  userCanApprove: true,
  approvedBy: [{ user: { id: 7, username: 'kenji-w', name: 'Kenji Watanabe', avatarUrl: null } }],
};

const CHECKS = {
  pipeline: { id: 9001, status: 'success', webUrl: null, sha: 'a41c9e2b7d3f' },
  jobs: [
    {
      id: 77,
      name: 'unit tests',
      stage: 'test',
      status: 'success',
      webUrl: null,
      allowFailure: false,
      duration: 83.5,
    },
  ],
};

const SETTINGS = {
  mergeMethod: 'merge',
  squashOption: 'never',
  onlyAllowMergeIfPipelineSucceeds: false,
};

const DIFF =
  'diff --git a/src/webhooks/applyWebhook.ts b/src/webhooks/applyWebhook.ts\n--- a/src/webhooks/applyWebhook.ts\n+++ b/src/webhooks/applyWebhook.ts\n@@ -1,2 +1,3 @@\n keep\n-old\n+new\n+more\n';

let mr: Mr = { ...BASE_MR };

const sent: Array<{ readonly command: string; readonly args: Record<string, unknown> }> = [];

export const resetGitlabMr = (): void => {
  mr = { ...BASE_MR };
  sent.length = 0;
};

export const gitlabCalls = ({
  command,
}: {
  readonly command: string;
}): ReadonlyArray<Record<string, unknown>> =>
  sent.filter((call) => call.command === command).map((call) => call.args);

const WRITES: ReadonlySet<string> = new Set([
  'gitlab_update_mr',
  'gitlab_update_mr_state',
  'gitlab_merge_mr',
]);

const applyWrite = ({
  command,
  args,
}: {
  readonly command: string;
  readonly args: Record<string, unknown>;
}): void => {
  if (command === 'gitlab_update_mr') {
    mr = {
      ...mr,
      ...(typeof args.title === 'string' && { title: args.title }),
      ...(typeof args.description === 'string' && { description: args.description }),
    };
  }
  if (command === 'gitlab_update_mr_state') {
    mr = { ...mr, state: args.stateEvent === 'close' ? 'closed' : 'opened' };
  }
  if (command === 'gitlab_merge_mr') {
    mr = { ...mr, state: 'merged', mergedAt: '2026-09-04T12:00:00Z' };
  }
};

export const gitlabPageBridge = (command: string, payload?: GhBridgeArgs): Promise<unknown> => {
  const args: Record<string, unknown> = { ...payload };
  if (command.startsWith('gitlab_')) {
    sent.push({ command, args });
  }
  if (WRITES.has(command)) {
    applyWrite({ command, args });
    return Promise.resolve(mr);
  }
  switch (command) {
    case 'worktree_remote_url':
      return Promise.resolve('git@gitlab.com:harborline/payments-api.git');
    case 'gitlab_get_mr':
    case 'gitlab_mr_for_branch':
      return Promise.resolve(mr);
    case 'gitlab_mr_approval_state':
      return Promise.resolve(APPROVALS);
    case 'gitlab_mr_pipeline_jobs':
      return Promise.resolve(CHECKS);
    case 'gitlab_mr_commits':
      return Promise.resolve([]);
    case 'gitlab_mr_diff':
      return Promise.resolve(DIFF);
    case 'gitlab_project_merge_methods':
      return Promise.resolve(SETTINGS);
    case 'gitlab_search_project_users':
      return Promise.resolve([]);
    case 'worktree_status':
      return checksBridge(command, payload).then((status) => ({
        ...(typeof status === 'object' && status !== null ? status : {}),
        upstream: 'origin/hl/fix-duplicate-credit',
        upstreamDistance: { kind: 'known', ahead: 0, behind: 0 },
      }));
    default:
      return checksBridge(command, payload);
  }
};
