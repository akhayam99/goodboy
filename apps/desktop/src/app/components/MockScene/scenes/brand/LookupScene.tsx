import { PaneShell } from '@goodboy/ui';
import { useEffect, useRef, useState } from 'react';
import { mockSceneIpc } from '../mockSceneIpc';
import type {
  GithubIssue,
  IntegrationBinding,
  IntegrationBindingId,
  IntegrationCredentialId,
} from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../../shared/components/StudioShell';
import { groupByDay } from '../../../../../shared/utils/groupByDay';
import { InboxDetail } from '../../../../../features/inbox/components/InboxStudio/InboxDetail';
import { InboxFacetRail } from '../../../../../features/inbox/components/InboxStudio/InboxFacetRail';
import { InboxList } from '../../../../../features/inbox/components/InboxStudio/InboxList';
import { InboxListHeader } from '../../../../../features/inbox/components/InboxStudio/InboxListHeader';
import { InboxLookupGroup } from '../../../../../features/inbox/components/InboxStudio/InboxLookupGroup';
import { InboxStarredGroup } from '../../../../../features/inbox/components/InboxStudio/InboxStarredGroup';
import { InboxStudioLayout } from '../../../../../features/inbox/components/InboxStudio/InboxStudioLayout';
import { adaptLinearIssues } from '../../../../../features/inbox/adapters/linear';
import { adaptSentryIssues } from '../../../../../features/inbox/adapters/sentry';
import { adaptSlackThreads } from '../../../../../features/inbox/adapters/slack';
import { adaptGithubIssues } from '../../../../../features/inbox/adapters/github';
import {
  NO_INBOX_FILTERS,
  filterInboxRecords,
  inboxFacetCounts,
} from '../../../../../features/inbox/kindFilter';
import { orderInboxRecords } from '../../../../../features/inbox/orderInboxRecords';
import type { InboxProvider, InboxRecord } from '../../../../../features/inbox/types';
import type { StarredRow } from '../../../../../features/inbox/useInboxStars';
import { buildIssueGroups as buildLinearGroups } from '../../../../../features/integrations/linear/LinearStudio/useLinearIssues';
import type {
  LinearIssue,
  LinearIssueComment,
} from '../../../../../features/integrations/linear/client';
import type { SentryIssue } from '../../../../../features/integrations/sentry/client';
import { linearIssueCandidate } from '../../../../../features/integrations/issueCandidateOf';
import type { WorkspaceIssueLookup } from '../../../../../features/integrations/hooks/useWorkspaceIssueLookup';
import { useAppStore } from '../../../../../store';
import { WORKSPACE_ID, seedBoardScene } from '../BoardScene';
import { StudioFrame } from '../StudioFrame';
import { seedStudioChrome } from '../shellChrome';
import { BRAND_PEOPLE, BRAND_PROJECTS, BRAND_SESSION, BRAND_WORKSPACE_NAME } from './canon';
import { HBL_398, HBL_412, kickoffIsoAgo, linearBindingOf } from './kickoffIssues';
import { SLACK_HEAD, SLACK_ONCALL_CHANNEL } from './slackThread';

const noop = () => undefined;
const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const QUERY = BRAND_SESSION.issue;
const ORG = BRAND_WORKSPACE_NAME.toLowerCase();

const LOOKUP_ISSUE: LinearIssue = HBL_412;

const [LOOKUP_RECORD] = adaptLinearIssues({ groups: buildLinearGroups([LOOKUP_ISSUE], new Map()) });

const LOOKUP: WorkspaceIssueLookup = {
  code: QUERY,
  settled: null,
  state:
    LOOKUP_RECORD === undefined
      ? { status: 'idle' }
      : {
          status: 'done',
          key: `${QUERY}#0`,
          value: {
            route: {
              kind: 'lookup',
              label: QUERY,
              targets: [{ provider: 'linear', identifier: QUERY }],
            },
            result: {
              hits: [
                {
                  target: { provider: 'linear', identifier: QUERY },
                  candidate: linearIssueCandidate(LOOKUP_ISSUE),
                  record: LOOKUP_RECORD,
                },
              ],
              misses: [],
            },
          },
        },
  loadingProviders: [],
  retryAt: null,
  retry: noop,
};

const SENTRY_ISSUE: SentryIssue = {
  id: 'mock-brand-sentry-4f2',
  project: null,
  shortId: 'PAYMENTS-API-4F2',
  title: BRAND_SESSION.sentry,
  culprit: BRAND_PROJECTS.payments.name,
  level: 'error',
  status: 'unresolved',
  count: '61',
  userCount: 23,
  firstSeen: kickoffIsoAgo(6 * DAY),
  lastSeen: kickoffIsoAgo(9 * MINUTE),
  permalink: `https://sentry.example.invalid/${ORG}/payments-api/issues/4f2`,
  metadata: null,
};

const [SENTRY_RECORD] = adaptSentryIssues({ rows: [{ issue: SENTRY_ISSUE, sessionId: null }] });

const SLACK_RECORDS = adaptSlackThreads({
  groups: [
    {
      key: SLACK_ONCALL_CHANNEL.id,
      label: SLACK_ONCALL_CHANNEL.name,
      rows: [{ channel: SLACK_ONCALL_CHANNEL, head: SLACK_HEAD, sessionId: null }],
    },
  ],
  now: new Date(),
});

const HBL_414: LinearIssue = {
  ...HBL_398,
  id: 'mock-brand-linear-hbl-414',
  identifier: 'HBL-414',
  title: `Show the processor event id on each ledger posting, split from ${QUERY}`,
  description:
    'Support wants to see the processor event id next to each posting in the ledger view.',
  state: { name: 'In Progress', type: 'started' },
  priority: 2,
  priorityLabel: 'High',
  creator: { name: BRAND_PEOPLE.reporter.name },
  project: { name: 'Ledger' },
  updatedAt: kickoffIsoAgo(34 * MINUTE),
};

const RELAY_ISSUE: GithubIssue = {
  number: 211,
  title: `Show a retried delivery as one row once ${QUERY} lands`,
  body: 'The delivery log lists every retry as its own row, so oncall reads one credit as five.',
  url: `https://github.com/${ORG}/${BRAND_PROJECTS.relay.name}/issues/211`,
  state: 'OPEN',
  labels: ['oncall'],
  updatedAt: kickoffIsoAgo(3 * HOUR),
  author: BRAND_PEOPLE.oncall.handle,
};

const [RELAY_RECORD] = adaptGithubIssues({
  groups: [
    {
      key: BRAND_PROJECTS.relay.name,
      label: BRAND_PROJECTS.relay.name,
      rows: [{ issue: RELAY_ISSUE, sessionId: null }],
    },
  ],
});

const STARRED_ALL: ReadonlyArray<StarredRow> = [
  ...(RELAY_RECORD === undefined
    ? []
    : [
        {
          issue: {
            workspaceId: WORKSPACE_ID,
            provider: 'github' as const,
            externalId: `${ORG}/${BRAND_PROJECTS.relay.name}#${RELAY_ISSUE.number}`,
            identifier: RELAY_RECORD.identifier,
            container: `${ORG}/${BRAND_PROJECTS.relay.name}`,
            title: RELAY_RECORD.title,
            url: RELAY_RECORD.url,
            state: 'open' as const,
            stateLabel: RELAY_RECORD.stateLabel,
            starredAt: kickoffIsoAgo(2 * HOUR),
            refreshedAt: kickoffIsoAgo(9 * MINUTE),
          },
          record: RELAY_RECORD,
        },
      ]),
  ...(SENTRY_RECORD === undefined
    ? []
    : [
        {
          issue: {
            workspaceId: WORKSPACE_ID,
            provider: 'sentry' as const,
            externalId: SENTRY_ISSUE.id,
            identifier: SENTRY_RECORD.identifier,
            container: null,
            title: SENTRY_RECORD.title,
            url: SENTRY_RECORD.url,
            state: 'alert' as const,
            stateLabel: SENTRY_RECORD.stateLabel,
            starredAt: kickoffIsoAgo(5 * DAY),
            refreshedAt: kickoffIsoAgo(9 * MINUTE),
          },
          record: SENTRY_RECORD,
        },
      ]),
];

const [HBL_414_RECORD] = adaptLinearIssues({ groups: buildLinearGroups([HBL_414], new Map()) });
const [HBL_398_RECORD] = adaptLinearIssues({ groups: buildLinearGroups([HBL_398], new Map()) });

type OtherParams = {
  readonly provider: InboxProvider;
  readonly kind: InboxRecord['kind'];
  readonly identifier: string;
  readonly title: string;
  readonly state: InboxRecord['state'];
  readonly ago: number;
};

const other = ({ provider, kind, identifier, title, state, ago }: OtherParams): InboxRecord =>
  ({
    key: `${provider}:${kind}:${identifier}`,
    provider,
    kind,
    identifier,
    title,
    state,
    stateLabel: state,
    updatedAt: kickoffIsoAgo(ago),
    url: '',
    context: '',
    payload: { provider, kind, sessionId: null },
  }) as unknown as InboxRecord;

const INBOX: ReadonlyArray<InboxRecord> = [
  ...SLACK_RECORDS,
  ...(HBL_414_RECORD === undefined ? [] : [HBL_414_RECORD]),
  ...(HBL_398_RECORD === undefined ? [] : [HBL_398_RECORD]),
  other({
    provider: 'linear',
    kind: 'issue',
    identifier: 'HBL-405',
    title: 'Expire processed webhook event ids after 30 days',
    state: 'open',
    ago: DAY,
  }),
  other({
    provider: 'linear',
    kind: 'issue',
    identifier: 'HBL-389',
    title: 'Paginate the ledger export endpoint',
    state: 'open',
    ago: 4 * DAY,
  }),
  other({
    provider: 'linear',
    kind: 'issue',
    identifier: 'HBL-377',
    title: 'Reconcile the ledger snapshot before the Monday close',
    state: 'active',
    ago: 2 * DAY,
  }),
  other({
    provider: 'github',
    kind: 'issue',
    identifier: '#204',
    title: 'Retry schedule ignores the tenant timezone',
    state: 'open',
    ago: 7 * HOUR,
  }),
  other({
    provider: 'sentry',
    kind: 'error',
    identifier: 'LEDGER-CORE-1C8',
    title: 'PostingConflict in settleBatch',
    state: 'alert',
    ago: DAY,
  }),
  other({
    provider: 'sentry',
    kind: 'error',
    identifier: 'NOTIFY-RELAY-9A',
    title: 'TimeoutError in deliverWebhook',
    state: 'alert',
    ago: 2 * DAY,
  }),
  other({
    provider: 'slack',
    kind: 'thread',
    identifier: '#ledger',
    title: 'Snapshot diff for Friday is attached',
    state: 'open',
    ago: 3 * HOUR,
  }),
  other({
    provider: 'slack',
    kind: 'thread',
    identifier: '#releases',
    title: 'notify-relay 4.12 is out',
    state: 'open',
    ago: DAY,
  }),
];

const STARRED_KEYS = new Set(
  STARRED_ALL.flatMap((row) => (row.record === null ? [] : [row.record.key])),
);

const COUNTED: ReadonlyArray<InboxRecord> = [
  ...INBOX,
  ...STARRED_ALL.flatMap((row) => (row.record === null ? [] : [row.record])),
];

const STARRED = STARRED_ALL.filter(
  (row) =>
    row.record !== null &&
    filterInboxRecords({ records: [row.record], query: QUERY, filters: NO_INBOX_FILTERS }).length >
      0,
);

const VISIBLE = filterInboxRecords({
  records: INBOX.filter((record) => !STARRED_KEYS.has(record.key)),
  query: QUERY,
  filters: NO_INBOX_FILTERS,
});

const CONNECTED: ReadonlyArray<InboxProvider> = ['github', 'linear', 'sentry', 'slack'];

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

type CommentParams = {
  readonly id: string;
  readonly name: string;
  readonly ago: number;
  readonly body: string;
  readonly parentId?: string;
};

const comment = ({ id, name, ago, body, parentId }: CommentParams): LinearIssueComment => ({
  id,
  body,
  createdAt: kickoffIsoAgo(ago),
  parent: parentId == null ? null : { id: parentId },
  user: { name, avatarUrl: null },
});

const COMMENTS: ReadonlyArray<LinearIssueComment> = [
  comment({
    id: 'hbl-412-c1',
    name: BRAND_PEOPLE.reporter.name,
    ago: 5 * HOUR,
    body: 'Pulled the 23 accounts from support. Every one has two credits with the same processor event id.',
  }),
  comment({
    id: 'hbl-412-c2',
    name: BRAND_PEOPLE.oncall.name,
    ago: 95 * MINUTE,
    body: 'Hit again on account 88213 an hour ago. Thread in #payments-oncall.',
  }),
  comment({
    id: 'hbl-412-c3',
    name: BRAND_PEOPLE.reviewer.name,
    ago: 80 * MINUTE,
    body: 'ledger-core already keeps one posting per event id, so the fix belongs in payments-api.',
    parentId: 'hbl-412-c2',
  }),
];

const SENTRY_BINDING: IntegrationBinding = {
  id: 'mock-brand-binding-sentry' as IntegrationBindingId,
  workspaceId: WORKSPACE_ID,
  projectId: null,
  credentialId: 'mock-brand-credential-sentry' as IntegrationCredentialId,
  provider: 'sentry',
  config: { org: ORG, project: BRAND_PROJECTS.payments.name },
  createdAt: kickoffIsoAgo(30 * DAY),
  updatedAt: kickoffIsoAgo(DAY),
};

const installIpc = (): void => {
  mockSceneIpc((cmd) => {
    if (cmd === 'linear_fetch_issue_comments') {
      return COMMENTS;
    }
    if (cmd === 'linear_fetch_issue') {
      return LOOKUP_ISSUE;
    }
    throw new Error(`${cmd} is not available in the brand scene`);
  });
};

export const BrandLookupScene = () => {
  const [isReady, setIsReady] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    installIpc();
    seedBoardScene();
    seedStudioChrome();
    useAppStore.setState({
      workspaceIntegrations: {
        [WORKSPACE_ID]: [linearBindingOf({ workspaceId: WORKSPACE_ID }), SENTRY_BINDING],
      },
    });
    setIsReady(true);
  }, []);

  if (!isReady || LOOKUP_RECORD === undefined) {
    return null;
  }

  const facets = (
    <InboxFacetRail
      filters={NO_INBOX_FILTERS}
      counts={inboxFacetCounts({ records: COUNTED, query: '', filters: NO_INBOX_FILTERS })}
      connected={CONNECTED}
      loading={NOT_LOADING}
      errors={NO_ERRORS}
      onFiltersChange={noop}
      onClearFilters={noop}
    />
  );

  const header = {
    query: QUERY,
    onQueryChange: noop,
    searchRef,
    sessionLabel: null,
    onClearSession: noop,
    isRefreshing: false,
    onRefresh: noop,
    activeFilterCount: 0,
    facets,
  };

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
              rail={facets}
              railHeader={<InboxListHeader {...header} isRailCollapsed={false} isSearchOnly />}
              list={({ isRailCollapsed, onDock }) => (
                <PaneShell
                  scroll="body"
                  title="Tasks"
                  meta={`${VISIBLE.length + STARRED.length} of ${COUNTED.length}`}
                  actions={
                    <InboxListHeader
                      {...header}
                      isRailCollapsed={isRailCollapsed}
                      onDock={onDock}
                    />
                  }
                >
                  <InboxLookupGroup
                    lookup={LOOKUP}
                    workspaceName={BRAND_WORKSPACE_NAME}
                    selectedKey={LOOKUP_RECORD.key}
                    onSelect={noop}
                  />
                  <InboxStarredGroup
                    rows={STARRED}
                    selectedKey={LOOKUP_RECORD.key}
                    unstarredCount={0}
                    onSelect={noop}
                    onUnstar={noop}
                    onUnstarClosed={noop}
                    onUndoUnstar={noop}
                  />
                  <InboxList
                    days={groupByDay({
                      items: orderInboxRecords({ records: VISIBLE }),
                      timestampOf: (item) => item.updatedAt,
                      now: new Date(),
                    })}
                    totalCount={COUNTED.length}
                    connectedCount={CONNECTED.length}
                    isLoading={false}
                    failures={[]}
                    hasFiltersActive
                    selectedKey={LOOKUP_RECORD.key}
                    onSelect={noop}
                    onRetry={noop}
                    onOpenSettings={noop}
                    onClearFilters={noop}
                  />
                </PaneShell>
              )}
              drawer={
                <InboxDetail
                  record={LOOKUP_RECORD}
                  workspaceId={WORKSPACE_ID}
                  rootPath={BRAND_PROJECTS.payments.rootPath}
                  errors={NO_ERRORS}
                  onRefresh={noop}
                  onClose={noop}
                  onDeselect={noop}
                  launchFocusRequest={0}
                />
              }
            />
          )}
        </StudioShell>
      }
    />
  );
};
