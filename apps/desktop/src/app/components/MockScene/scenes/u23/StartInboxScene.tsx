import { useMemo } from 'react';
import { mockIPC } from '@tauri-apps/api/mocks';
import type { GithubInboxPrRole, PullRequestState } from '@goodboy/types';
import { adaptGithubPrs } from '../../../../../features/inbox/adapters/github';
import { adaptLinearIssues } from '../../../../../features/inbox/adapters/linear';
import { InboxDetail } from '../../../../../features/inbox/components/InboxStudio/InboxDetail';
import { orderInboxRecords } from '../../../../../features/inbox/orderInboxRecords';
import type { InboxProvider, InboxRecord } from '../../../../../features/inbox/types';
import type { GithubPrGroup } from '../../../../../features/integrations/github/components/PullRequest/useGithubPrs';
import type { LinearIssue } from '../../../../../features/integrations/linear/client';
import { buildIssueGroups } from '../../../../../features/integrations/linear/LinearStudio/buildIssueGroups';
import { WORKSPACE_ID } from '../BoardScene';
import { LINEAR_PICKER_ANSWERS } from '../linearPickerAnswers';
import { TasksStage } from '../u25/c12/TasksStage';

type Variant = 'issue' | 'review';

type Props = {
  readonly variant: Variant;
};

const noop = () => undefined;
const MINUTE = 60_000;
const HOUR = 3_600_000;
const ROOT_PATH = '~/code/harborline/payments-api';
const CONNECTED: ReadonlyArray<InboxProvider> = ['github', 'linear'];

const isoAgo = (offsetMs: number): string => new Date(Date.now() - offsetMs).toISOString();

const NO_ERRORS: Readonly<Record<InboxProvider, string | null>> = {
  github: null,
  gitlab: null,
  linear: null,
  jira: null,
  sentry: null,
  slack: null,
  bitbucket: null,
};

const NOT_LOADING: Readonly<Record<InboxProvider, boolean>> = {
  github: false,
  gitlab: false,
  linear: false,
  jira: false,
  sentry: false,
  slack: false,
  bitbucket: false,
};

type LinearParams = {
  readonly id: string;
  readonly identifier: string;
  readonly title: string;
  readonly description: string;
  readonly ago: number;
};

const linearIssue = ({ id, identifier, title, description, ago }: LinearParams): LinearIssue => ({
  id,
  identifier,
  title,
  description,
  url: `https://linear.app/harborline/issue/${identifier}`,
  state: { name: 'Todo', type: 'unstarted' },
  team: { key: 'HBL' },
  priority: 2,
  priorityLabel: 'High',
  assignee: { name: 'Harborline QA' },
  project: { name: 'Payments' },
  labels: { nodes: [] },
  updatedAt: isoAgo(ago),
});

const LINEAR_ISSUES: ReadonlyArray<LinearIssue> = [
  linearIssue({
    id: 'hbl-412',
    identifier: 'HBL-412',
    title: 'Retried webhooks post a second credit',
    description:
      'When the processor redelivers an event, payments-api credits the account again. Northwind finance counted 23 accounts credited twice last week.',
    ago: 42 * MINUTE,
  }),
  linearIssue({
    id: 'hbl-409',
    identifier: 'HBL-409',
    title: 'notify-relay retries settled batches after a 429',
    description: 'After a 429 the relay retries batches that already settled.',
    ago: 26 * HOUR,
  }),
  linearIssue({
    id: 'hbl-388',
    identifier: 'HBL-388',
    title: 'Add a dry run flag to the payout backfill',
    description: 'Ops wants to preview a backfill before it writes any rows.',
    ago: 12 * 24 * HOUR,
  }),
];

type PrParams = {
  readonly number: number;
  readonly title: string;
  readonly headBranch: string;
  readonly ago: number;
};

const pullRequest = ({ number, title, headBranch, ago }: PrParams): PullRequestState => ({
  number,
  title,
  url: `https://github.com/harborline/payments-api/pull/${number}`,
  state: 'open',
  mergeable: true,
  checks: 'success',
  baseBranch: 'main',
  headBranch,
  isDraft: false,
  reviewDecision: null,
  body: 'One credit per processor event, however often the processor redelivers it.',
  updatedAt: isoAgo(ago),
  author: 'nadia-p',
});

const PR_GROUPS: ReadonlyArray<GithubPrGroup> = [
  {
    key: 'review-requested' satisfies GithubInboxPrRole,
    label: 'Review requested',
    rows: [
      {
        pr: pullRequest({
          number: 318,
          title: 'Stop retried webhooks posting a second credit',
          headBranch: 'nadia-p/single-credit',
          ago: 30 * MINUTE,
        }),
        role: 'review-requested',
        sessionId: null,
      },
      {
        pr: pullRequest({
          number: 204,
          title: 'Keep the processor event id on every credit row',
          headBranch: 'nadia-p/event-id',
          ago: 5 * HOUR,
        }),
        role: 'review-requested',
        sessionId: null,
      },
    ],
  },
];

const REPO_SLUG = 'harborline/payments-api';

const isRepoSlugCall = ({ payload }: { readonly payload: unknown }): boolean =>
  typeof payload === 'object' &&
  payload !== null &&
  'args' in payload &&
  Array.isArray(payload.args) &&
  payload.args.includes('nameWithOwner');

export const startInboxIpc = ({
  command,
  payload,
}: {
  readonly command: string;
  readonly payload: unknown;
}): unknown => {
  if (command === 'linear_fetch_issue_comments') {
    return [];
  }
  const pickerAnswer = LINEAR_PICKER_ANSWERS[command];
  if (pickerAnswer !== undefined) {
    return pickerAnswer();
  }
  if (command === 'gh_run') {
    return {
      stdout: isRepoSlugCall({ payload }) ? REPO_SLUG : '[]',
      stderr: '',
      exitCode: 0,
    };
  }
  return null;
};

const installIpc = (): void => {
  mockIPC((command, payload) => startInboxIpc({ command, payload }));
};

const recordsOf = ({ variant }: Props): ReadonlyArray<InboxRecord> =>
  variant === 'issue'
    ? adaptLinearIssues({
        groups: buildIssueGroups({ issues: LINEAR_ISSUES, sessionIdByExternalId: new Map() }),
      })
    : adaptGithubPrs({ groups: PR_GROUPS });

export const StartInboxScene = ({ variant }: Props) => {
  const records = useMemo(() => recordsOf({ variant }), [variant]);
  const selected = orderInboxRecords({ records })[0] ?? null;

  return (
    <TasksStage
      records={records}
      scope="all"
      groupBy="source"
      connected={CONNECTED}
      selectedKey={selected?.key ?? null}
      cursorKey={selected?.key ?? null}
      onSeed={installIpc}
      drawer={
        selected === null ? null : (
          <InboxDetail
            record={selected}
            workspaceId={WORKSPACE_ID}
            rootPath={ROOT_PATH}
            errors={NO_ERRORS}
            onRefresh={noop}
            onClose={noop}
            onDeselect={noop}
            onOpenFull={noop}
            star={null}
            launchFocusRequest={0}
          />
        )
      }
    />
  );
};
