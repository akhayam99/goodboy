import { useEffect, useMemo, useRef, useState } from 'react';
import { mockIPC } from '@tauri-apps/api/mocks';
import { PaneShell } from '@goodboy/ui';
import type { GithubInboxPrRole, PullRequestState } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../../shared/components/StudioShell';
import { groupByDay } from '../../../../../shared/utils/groupByDay';
import { adaptGithubPrs } from '../../../../../features/inbox/adapters/github';
import { adaptLinearIssues } from '../../../../../features/inbox/adapters/linear';
import { InboxDetail } from '../../../../../features/inbox/components/InboxStudio/InboxDetail';
import { InboxFacetRail } from '../../../../../features/inbox/components/InboxStudio/InboxFacetRail';
import { InboxList } from '../../../../../features/inbox/components/InboxStudio/InboxList';
import { InboxListHeader } from '../../../../../features/inbox/components/InboxStudio/InboxListHeader';
import { InboxStudioLayout } from '../../../../../features/inbox/components/InboxStudio/InboxStudioLayout';
import {
  NO_INBOX_FILTERS,
  activeFilterCount,
  filterInboxRecords,
  inboxFacetCounts,
} from '../../../../../features/inbox/kindFilter';
import { orderInboxRecords } from '../../../../../features/inbox/orderInboxRecords';
import { recordCanReply } from '../../../../../features/inbox/recordCanReply';
import type { InboxProvider, InboxRecord } from '../../../../../features/inbox/types';
import type { GithubPrGroup } from '../../../../../features/integrations/github/components/PullRequest/useGithubPrs';
import type { LinearIssue } from '../../../../../features/integrations/linear/client';
import { buildIssueGroups } from '../../../../../features/integrations/linear/LinearStudio/useLinearIssues';
import { WORKSPACE_ID, seedBoardScene } from '../BoardScene';
import { StudioFrame } from '../StudioFrame';
import { seedStudioChrome } from '../shellChrome';

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
  assignee: { name: 'Nadia Petrov' },
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
    ? adaptLinearIssues({ groups: buildIssueGroups(LINEAR_ISSUES, new Map()) })
    : adaptGithubPrs({ groups: PR_GROUPS });

export const StartInboxScene = ({ variant }: Props) => {
  const [isReady, setIsReady] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const records = useMemo(() => recordsOf({ variant }), [variant]);

  useEffect(() => {
    installIpc();
    seedBoardScene();
    seedStudioChrome();
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  const visible = filterInboxRecords({
    records: [...records],
    query: '',
    filters: NO_INBOX_FILTERS,
  });
  const selected = visible[0] ?? null;

  return (
    <StudioFrame
      target={{ place: 'inbox', tool: null }}
      main={
        <StudioShell
          icon={CONCEPT_ICONS.inbox}
          tone={CONCEPT_TONE.inbox}
          title="Tasks"
          closeLabel="Close tasks"
          onClose={noop}
        >
          {() => (
            <InboxStudioLayout
              list={
                <PaneShell
                  scroll="body"
                  title="Tasks"
                  meta={`${visible.length} items`}
                  actions={
                    <InboxListHeader
                      query=""
                      onQueryChange={noop}
                      searchRef={searchRef}
                      sessionLabel={null}
                      onClearSession={noop}
                      isRefreshing={false}
                      onRefresh={noop}
                      activeFilterCount={activeFilterCount({ filters: NO_INBOX_FILTERS })}
                      facets={
                        <InboxFacetRail
                          filters={NO_INBOX_FILTERS}
                          counts={inboxFacetCounts({
                            records: [...records],
                            query: '',
                            filters: NO_INBOX_FILTERS,
                          })}
                          connected={CONNECTED}
                          loading={NOT_LOADING}
                          errors={NO_ERRORS}
                          projects={[]}
                          canReply={recordCanReply({ record: selected })}
                          onFiltersChange={noop}
                          onClearFilters={noop}
                        />
                      }
                    />
                  }
                >
                  <InboxList
                    days={groupByDay({
                      items: orderInboxRecords({ records: visible }),
                      timestampOf: (item) => item.updatedAt,
                      now: new Date(),
                    })}
                    totalCount={records.length}
                    connectedCount={CONNECTED.length}
                    isLoading={false}
                    failures={[]}
                    hasFiltersActive
                    selectedKey={selected?.key ?? null}
                    onSelect={noop}
                    onRetry={noop}
                    onOpenSettings={noop}
                    onClearFilters={noop}
                  />
                </PaneShell>
              }
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
                    launchFocusRequest={0}
                  />
                )
              }
            />
          )}
        </StudioShell>
      }
    />
  );
};
