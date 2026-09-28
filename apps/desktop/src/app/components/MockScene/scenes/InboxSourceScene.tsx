import { useEffect, useMemo, useState } from 'react';
import { mockIPC } from '@tauri-apps/api/mocks';
import { IconButton } from '@goodboy/ui';
import { RefreshCw } from 'lucide-react';
import type { ProjectId, ProjectSentryLink } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { groupByDay } from '../../../../shared/utils/groupByDay';
import { useAppStore } from '../../../../store';
import { adaptLinearIssues } from '../../../../features/inbox/adapters/linear';
import { adaptSentryIssues } from '../../../../features/inbox/adapters/sentry';
import { attachInboxProjects } from '../../../../features/inbox/attachInboxProjects';
import { InboxDetail } from '../../../../features/inbox/components/InboxStudio/InboxDetail';
import { InboxFacetRail } from '../../../../features/inbox/components/InboxStudio/InboxFacetRail';
import { InboxList } from '../../../../features/inbox/components/InboxStudio/InboxList';
import { InboxStudioLayout } from '../../../../features/inbox/components/InboxStudio/InboxStudioLayout';
import {
  NO_INBOX_FILTERS,
  filterInboxRecords,
  inboxFacetCounts,
  type InboxFilters,
} from '../../../../features/inbox/kindFilter';
import { orderInboxRecords } from '../../../../features/inbox/orderInboxRecords';
import type { InboxProvider } from '../../../../features/inbox/types';
import type { LinearIssue } from '../../../../features/integrations/linear/client';
import { buildIssueGroups } from '../../../../features/integrations/linear/LinearStudio/useLinearIssues';
import type { SentryIssue } from '../../../../features/integrations/sentry/client';
import { WORKSPACE_ID, seedBoardScene } from './BoardScene';
import { StudioFrame } from './StudioFrame';
import { seedStudioChrome } from './shellChrome';

const noop = () => undefined;
const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
const ROOT_PATH = '~/code/harborline/payments-api';

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

const LINKS: ReadonlyArray<ProjectSentryLink> = [
  {
    projectId: 'mock-board-project-payments-api' as ProjectId,
    sentryProject: 'payments-api',
  } as ProjectSentryLink,
  {
    projectId: 'mock-board-project-notify-relay' as ProjectId,
    sentryProject: 'notify-relay',
  } as ProjectSentryLink,
];

type SentryParams = {
  readonly id: string;
  readonly shortId: string;
  readonly slug: string;
  readonly title: string;
  readonly culprit: string;
  readonly ago: number;
};

const sentryIssue = ({ id, shortId, slug, title, culprit, ago }: SentryParams): SentryIssue => ({
  id,
  project: { slug, name: slug } as SentryIssue['project'],
  shortId,
  title,
  culprit,
  level: 'error',
  status: 'unresolved',
  count: '42',
  userCount: 9,
  firstSeen: isoAgo(ago + 2 * DAY),
  lastSeen: isoAgo(ago),
  permalink: `https://harborline.sentry.io/issues/${id}/`,
  metadata: null,
});

const SENTRY_ISSUES: ReadonlyArray<SentryIssue> = [
  sentryIssue({
    id: '7001',
    shortId: 'PAYMENTS-API-7K1',
    slug: 'payments-api',
    title: 'DuplicateChargeError: charge already captured for order',
    culprit: 'settle_batch',
    ago: 8 * MINUTE,
  }),
  sentryIssue({
    id: '7002',
    shortId: 'NOTIFY-RELAY-3F',
    slug: 'notify-relay',
    title: 'GoneError: webhook endpoint returned 410',
    culprit: 'deliver_webhook',
    ago: 70 * MINUTE,
  }),
  sentryIssue({
    id: '7003',
    shortId: 'PAYMENTS-API-7J9',
    slug: 'payments-api',
    title: 'TimeoutError in the refund worker',
    culprit: 'refund_split_payment',
    ago: 5 * HOUR,
  }),
  sentryIssue({
    id: '7004',
    shortId: 'NOTIFY-RELAY-2A',
    slug: 'notify-relay',
    title: 'KeyError: tenant_id missing from the event',
    culprit: 'route_event',
    ago: 27 * HOUR,
  }),
];

type LinearParams = {
  readonly id: string;
  readonly identifier: string;
  readonly title: string;
  readonly team: string;
  readonly project: string | null;
  readonly ago: number;
};

const linearIssue = ({ id, identifier, title, team, project, ago }: LinearParams): LinearIssue => ({
  id,
  identifier,
  title,
  description: null,
  url: `https://linear.app/northwind/issue/${identifier}`,
  state: { name: 'Todo', type: 'unstarted' },
  team: { key: team },
  priority: 2,
  priorityLabel: 'High',
  assignee: { name: 'Platform lead' },
  project: project === null ? null : { name: project },
  labels: { nodes: [] },
  updatedAt: isoAgo(ago),
});

const LINEAR_ISSUES: ReadonlyArray<LinearIssue> = [
  linearIssue({
    id: 'l1',
    identifier: 'NW-231',
    title: 'Refunds on split payments leave the second charge captured',
    team: 'NW',
    project: 'Payments',
    ago: 25 * MINUTE,
  }),
  linearIssue({
    id: 'l2',
    identifier: 'NW-212',
    title: 'Per-tenant rate limits on the public API',
    team: 'NW',
    project: 'Platform',
    ago: 4 * HOUR,
  }),
  linearIssue({
    id: 'l3',
    identifier: 'ACME-44',
    title: 'Export button stays disabled after a failed export',
    team: 'ACME',
    project: null,
    ago: 9 * HOUR,
  }),
  linearIssue({
    id: 'l4',
    identifier: 'NW-198',
    title: 'Checkout retries charge twice',
    team: 'NW',
    project: 'Payments',
    ago: 2 * DAY,
  }),
];

const DEFAULT_CONNECTED: ReadonlyArray<InboxProvider> = ['github', 'linear', 'sentry'];

const PROJECT_BY_SLUG: Readonly<Record<string, ProjectId>> = {
  'payments-api': 'mock-board-project-payments-api' as ProjectId,
  'notify-relay': 'mock-board-project-notify-relay' as ProjectId,
};

const installIpc = (): void => {
  mockIPC((cmd) => {
    if (cmd === 'sentry_fetch_issue_detail') {
      return {
        title: SENTRY_ISSUES[0]?.title ?? null,
        culprit: 'settle_batch',
        frames: [
          { filename: 'payments/settle.py', function: 'settle_batch', line_no: 88, in_app: true },
          { filename: 'payments/charge.py', function: 'capture', line_no: 41, in_app: true },
        ],
        tags: [{ key: 'environment', value: 'production' }],
        breadcrumbs: [],
      };
    }
    if (cmd === 'sentry_list_code_mappings') {
      return [];
    }
    if (cmd === 'linear_fetch_issue_comments') {
      return [];
    }
    return null;
  });
};

type Variant = {
  readonly source: 'sentry' | 'linear' | null;
  readonly project: ProjectId | null;
  readonly connected: ReadonlyArray<InboxProvider>;
  readonly isLaunching: boolean;
};

const SOURCE_TITLE = { sentry: 'Sentry', linear: 'Linear' } as const;

const readSource = ({ value }: { readonly value: string | null }): Variant['source'] => {
  if (value === 'linear' || value === 'sentry') {
    return value;
  }
  return value === 'all' ? null : 'sentry';
};

const readVariant = (): Variant => {
  const params = new URLSearchParams(window.location.search);
  const connected = (params.get('connected') ?? '')
    .split(',')
    .filter((entry): entry is InboxProvider => DEFAULT_CONNECTED.includes(entry as InboxProvider));
  return {
    source: readSource({ value: params.get('source') }),
    project: PROJECT_BY_SLUG[params.get('project') ?? ''] ?? null,
    connected: connected.length === 0 ? DEFAULT_CONNECTED : connected,
    isLaunching: params.get('launch') === '1',
  };
};

export const InboxSourceScene = () => {
  const [isReady, setIsReady] = useState(false);
  const [variant] = useState(readVariant);
  const [filters, setFilters] = useState<InboxFilters>(() => ({
    ...NO_INBOX_FILTERS,
    source: variant.source,
    project: variant.project,
  }));
  const projects = useAppStore((state) => state.projects);

  useEffect(() => {
    installIpc();
    seedBoardScene();
    seedStudioChrome();
    useAppStore.setState((state) => ({
      projectSentryLinks: { ...state.projectSentryLinks, [WORKSPACE_ID]: LINKS },
    }));
    setIsReady(true);
  }, []);

  const [launchRequest, setLaunchRequest] = useState(0);
  useEffect(() => {
    if (!isReady || !variant.isLaunching) {
      return;
    }
    const timer = setTimeout(() => setLaunchRequest(1), 300);
    return () => clearTimeout(timer);
  }, [isReady, variant.isLaunching]);

  const records = useMemo(
    () =>
      attachInboxProjects({
        records: [
          ...adaptSentryIssues({
            rows: SENTRY_ISSUES.map((issue) => ({ issue, sessionId: null })),
          }),
          ...adaptLinearIssues({ groups: buildIssueGroups(LINEAR_ISSUES, new Map()) }),
        ],
        projects,
        links: LINKS,
      }),
    [projects],
  );

  if (!isReady) {
    return null;
  }

  const visible = filterInboxRecords({ records, query: '', filters });
  const selected = visible[0] ?? null;

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
                  filters={filters}
                  counts={inboxFacetCounts({ records, query: '', filters })}
                  connected={variant.connected}
                  loading={NOT_LOADING}
                  errors={NO_ERRORS}
                  projects={projects}
                  onFiltersChange={setFilters}
                  onClearFilters={() => setFilters(NO_INBOX_FILTERS)}
                />
              }
              list={
                <PaneShell
                  scroll="body"
                  title={
                    filters.source === 'sentry' || filters.source === 'linear'
                      ? SOURCE_TITLE[filters.source]
                      : 'Inbox'
                  }
                  meta={`${visible.length} items`}
                  actions={<IconButton icon={RefreshCw} label="Refresh inbox" onClick={noop} />}
                >
                  <InboxList
                    days={groupByDay({
                      items: orderInboxRecords({ records: visible }),
                      timestampOf: (item) => item.updatedAt,
                      now: new Date(),
                    })}
                    totalCount={records.length}
                    connectedCount={variant.connected.length}
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
                    launchFocusRequest={launchRequest}
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
