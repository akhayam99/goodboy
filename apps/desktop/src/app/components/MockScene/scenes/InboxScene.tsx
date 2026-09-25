import { useEffect, useState } from 'react';
import { mockIPC } from '@tauri-apps/api/mocks';
import { IconButton } from '@goodboy/ui';
import { RefreshCw } from 'lucide-react';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { InboxDetail } from '../../../../features/inbox/components/InboxStudio/InboxDetail';
import { InboxFacetRail } from '../../../../features/inbox/components/InboxStudio/InboxFacetRail';
import { InboxList } from '../../../../features/inbox/components/InboxStudio/InboxList';
import { InboxStudioLayout } from '../../../../features/inbox/components/InboxStudio/InboxStudioLayout';
import { NO_INBOX_FILTERS, inboxFacetCounts } from '../../../../features/inbox/kindFilter';
import { orderInboxRecords } from '../../../../features/inbox/orderInboxRecords';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { groupByDay } from '../../../../shared/utils/groupByDay';
import type { InboxKind, InboxProvider, InboxRecord } from '../../../../features/inbox/types';
import type {
  LinearIssue,
  LinearIssueComment,
} from '../../../../features/integrations/linear/client';
import { WORKSPACE_ID, seedBoardScene } from './BoardScene';
import { StudioFrame } from './StudioFrame';
import { seedStudioChrome } from './shellChrome';

const noop = () => undefined;
const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const ROOT_PATH = '/mock/cascade/core-api';

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

const SELECTED_ISSUE: LinearIssue = {
  id: 'mock-inbox-linear-cas-231',
  identifier: 'CAS-231',
  title: 'Refunds on split payments leave the second charge captured',
  description: [
    'When a customer pays with two cards and asks for a full refund, only the first charge is refunded. The second stays captured and support has to refund it by hand.',
    '',
    'Seen on 14 orders this week, all paid with a gift card plus a credit card. One refund request should refund every charge on the order.',
  ].join('\n'),
  url: 'https://example.invalid/linear/CAS-231',
  state: { name: 'Todo', type: 'unstarted' },
  team: { key: 'CAS' },
  priority: 2,
  priorityLabel: 'High',
  assignee: { name: 'Robin Vale' },
  project: { name: 'Payments' },
  labels: {
    nodes: [
      { name: 'bug', color: '#eb5757' },
      { name: 'refunds', color: '#5e6ad2' },
    ],
  },
  updatedAt: isoAgo(25 * MINUTE),
};

type CommentParams = {
  readonly id: string;
  readonly name: string;
  readonly ago: number;
  readonly body: string;
  readonly parentId?: string;
};

const linearComment = ({ id, name, ago, body, parentId }: CommentParams): LinearIssueComment => ({
  id,
  body,
  createdAt: isoAgo(ago),
  parent: parentId == null ? null : { id: parentId },
  user: { name, avatarUrl: null },
});

const SELECTED_COMMENTS: ReadonlyArray<LinearIssueComment> = [
  linearComment({
    id: 'cas-231-c1',
    name: 'Robin Vale',
    ago: 3 * HOUR,
    body: 'Reproduced on staging with a gift card plus a card. The refund job only walks the first charge on the order.',
  }),
  linearComment({
    id: 'cas-231-c2',
    name: 'Jules Marin',
    ago: 2 * HOUR,
    body: 'Do we refund the gift card first or the card? Support has been doing the card first.',
    parentId: 'cas-231-c1',
  }),
  linearComment({
    id: 'cas-231-c3',
    name: 'Robin Vale',
    ago: 110 * MINUTE,
    body: 'Card first, then the gift card balance. Same order as capture, reversed.',
    parentId: 'cas-231-c1',
  }),
  linearComment({
    id: 'cas-231-c4',
    name: 'Priya Nand',
    ago: 40 * MINUTE,
    body: 'Finance wants a list of the 14 orders before we touch them. I will pull it from ledger-core.',
  }),
];

const installIpc = (): void => {
  let created = 0;
  mockIPC((cmd, payload) => {
    if (cmd === 'linear_fetch_issue_comments') {
      return SELECTED_COMMENTS;
    }
    if (cmd === 'linear_create_comment') {
      const args = (payload ?? {}) as { body?: string; parentId?: string | null };
      created += 1;
      return linearComment({
        id: `cas-231-new-${created}`,
        name: 'You',
        ago: 0,
        body: args.body ?? '',
        parentId: args.parentId ?? undefined,
      });
    }
    return null;
  });
};

type RecordParams = {
  readonly provider: InboxProvider;
  readonly kind: InboxKind;
  readonly identifier: string;
  readonly title: string;
  readonly state: InboxRecord['state'];
  readonly ago: number;
  readonly context: string;
};

const STATE_WORD = {
  open: 'Open',
  active: 'In Progress',
  done: 'Done',
  alert: 'Unresolved',
} satisfies Record<InboxRecord['state'], string>;

const record = ({ provider, kind, identifier, title, state, ago, context }: RecordParams) =>
  ({
    key: `${provider}:${kind}:${identifier}`,
    provider,
    kind,
    identifier,
    title,
    state,
    stateLabel: STATE_WORD[state],
    updatedAt: isoAgo(ago),
    url: `https://example.invalid/${provider}/${identifier}`,
    context,
    payload: { provider, kind, sessionId: null },
  }) as unknown as InboxRecord;

const SELECTED_RECORD: InboxRecord = {
  key: `linear:issue:${SELECTED_ISSUE.id}`,
  provider: 'linear',
  kind: 'issue',
  identifier: SELECTED_ISSUE.identifier,
  title: SELECTED_ISSUE.title,
  state: 'open',
  stateLabel: 'Todo',
  updatedAt: SELECTED_ISSUE.updatedAt,
  url: SELECTED_ISSUE.url,
  context: 'Payments',
  payload: { provider: 'linear', kind: 'issue', issue: SELECTED_ISSUE, sessionId: null },
};

const RECORDS: ReadonlyArray<InboxRecord> = [
  record({
    provider: 'sentry',
    kind: 'error',
    identifier: 'CORE-API-7K1',
    title: 'DuplicateChargeError: charge already captured for order',
    state: 'alert',
    ago: 8 * MINUTE,
    context: 'core-api',
  }),
  SELECTED_RECORD,
  record({
    provider: 'github',
    kind: 'issue',
    identifier: '#187',
    title: 'The admin sessions table loads every row at once',
    state: 'open',
    ago: 50 * MINUTE,
    context: 'cascade/web-console',
  }),
  record({
    provider: 'slack',
    kind: 'thread',
    identifier: '#payments-oncall',
    title: 'Anyone else seeing webhook retries pile up since the deploy?',
    state: 'open',
    ago: 2 * HOUR,
    context: 'payments-oncall',
  }),
  record({
    provider: 'jira',
    kind: 'issue',
    identifier: 'FIN-91',
    title: 'Reconcile the nightly settlement export before the Monday close',
    state: 'active',
    ago: 3 * HOUR,
    context: 'Finance',
  }),
  record({
    provider: 'linear',
    kind: 'issue',
    identifier: 'CAS-212',
    title: 'Per-tenant rate limits on the public API',
    state: 'active',
    ago: 5 * HOUR,
    context: 'Platform',
  }),
  record({
    provider: 'github',
    kind: 'issue',
    identifier: '#192',
    title: 'Export button stays disabled after a failed export',
    state: 'open',
    ago: 9 * HOUR,
    context: 'cascade/web-console',
  }),
  record({
    provider: 'sentry',
    kind: 'error',
    identifier: 'WAREHOUSE-2C4',
    title: 'LedgerSnapshotMismatch in nightly_reconcile',
    state: 'alert',
    ago: 26 * HOUR,
    context: 'reporting-warehouse',
  }),
  record({
    provider: 'linear',
    kind: 'issue',
    identifier: 'CAS-198',
    title: 'Checkout retries charge twice',
    state: 'active',
    ago: 2 * DAY,
    context: 'Payments',
  }),
  record({
    provider: 'jira',
    kind: 'issue',
    identifier: 'FIN-88',
    title: 'Settlement export off by a few cents',
    state: 'active',
    ago: 3 * DAY,
    context: 'Finance',
  }),
];

const CONNECTED: ReadonlyArray<InboxProvider> = ['github', 'linear', 'jira', 'sentry', 'slack'];

export const InboxScene = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    installIpc();
    seedBoardScene();
    seedStudioChrome();
    setIsReady(true);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <StudioFrame
      target="inbox"
      main={
        <StudioShell
          icon={CONCEPT_ICONS.inbox}
          tone={CONCEPT_TONE.inbox}
          title="Inbox"
          closeLabel="close inbox"
          onClose={noop}
        >
          {() => (
            <InboxStudioLayout
              rail={
                <InboxFacetRail
                  filters={NO_INBOX_FILTERS}
                  counts={inboxFacetCounts({
                    records: RECORDS,
                    query: '',
                    filters: NO_INBOX_FILTERS,
                  })}
                  connected={CONNECTED}
                  loading={NOT_LOADING}
                  errors={NO_ERRORS}
                  onFiltersChange={noop}
                  onClearFilters={noop}
                />
              }
              list={
                <PaneShell
                  scroll="body"
                  title="All items"
                  meta={`${RECORDS.length} items`}
                  actions={<IconButton icon={RefreshCw} label="Refresh inbox" onClick={noop} />}
                >
                  <InboxList
                    days={groupByDay({
                      items: orderInboxRecords({ records: RECORDS }),
                      timestampOf: (item) => item.updatedAt,
                      now: new Date(),
                    })}
                    totalCount={RECORDS.length}
                    connectedCount={CONNECTED.length}
                    isLoading={false}
                    failures={[]}
                    hasFiltersActive={false}
                    selectedKey={SELECTED_RECORD.key}
                    onSelect={noop}
                    onRetry={noop}
                    onOpenSettings={noop}
                    onClearFilters={noop}
                  />
                </PaneShell>
              }
              drawer={
                <InboxDetail
                  record={SELECTED_RECORD}
                  workspaceId={WORKSPACE_ID}
                  rootPath={ROOT_PATH}
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
