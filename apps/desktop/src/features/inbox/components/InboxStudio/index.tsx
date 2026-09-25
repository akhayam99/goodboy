import { openToolSettings } from '../../../integrations/openToolSettings';
import { useEffect, useMemo, useRef, useState } from 'react';
import { inlineMarkdownText, useEscapeLayer } from '@goodboy/ui';
import type { SessionId, WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { useElementWidth } from '../../../../shared/hooks/useElementWidth';
import { useListKeys } from '../../../../shared/hooks/useListKeys';
import { openUrl } from '../../../../shared/lib/editor';
import { groupByDay } from '../../../../shared/utils/groupByDay';
import { useSessionById } from '../../../../store';
import { recordSessionId } from '../../recordSessionId';
import { useInboxRecords } from '../../useInboxRecords';
import { orderInboxRecords } from '../../orderInboxRecords';
import { INBOX_PROVIDERS, type InboxKind, type InboxProvider } from '../../types';
import {
  NO_INBOX_FILTERS,
  activeFilterCount,
  filterInboxRecords,
  inboxFacetCounts,
  type InboxFilters,
  type InboxKindFilter,
  type InboxView,
} from '../../kindFilter';
import { readInboxFilters, writeInboxFilters } from '../../kindFilterStorage';
import { InboxDetail } from './InboxDetail';
import { InboxFacetRail } from './InboxFacetRail';
import { InboxList, type InboxLoadFailure } from './InboxList';
import { InboxListHeader } from './InboxListHeader';
import { InboxStudioLayout } from './InboxStudioLayout';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly rootPath: string;
  readonly initialProvider?: InboxProvider | null;
  readonly initialKind?: InboxKind | null;
  readonly initialRecordKey?: string | null;
  readonly initialSessionId?: SessionId | null;
  readonly onClose: () => void;
};

const FACET_RAIL_PX = 256;
const COLUMN_FOLD_PX = 720;

const VIEW_TITLE = {
  all: 'All items',
  'in-progress': 'In progress',
  'with-session': 'With a session',
  closed: 'Closed',
} satisfies Record<InboxView, string>;

type KindToFilterParams = {
  readonly kind: InboxKind;
};

const kindToFilter = ({ kind }: KindToFilterParams): InboxKindFilter => {
  switch (kind) {
    case 'issue':
      return 'issue';
    case 'pr':
    case 'mr':
      return 'pr-mr';
    case 'thread':
      return 'thread';
    case 'error':
      return 'error';
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
};

type InitialFiltersParams = {
  readonly workspaceId: WorkspaceId;
  readonly initialKind: InboxKind | null;
  readonly initialProvider: InboxProvider | null;
};

const initialFilters = ({
  workspaceId,
  initialKind,
  initialProvider,
}: InitialFiltersParams): InboxFilters => {
  const stored = readInboxFilters({ workspaceId });
  return {
    view: 'all',
    kind: initialKind != null ? kindToFilter({ kind: initialKind }) : (stored?.kind ?? 'all'),
    source: initialProvider ?? (initialKind != null ? null : (stored?.source ?? null)),
  };
};

type SummaryParams = {
  readonly total: number;
  readonly visible: number;
  readonly withSession: number;
};

const summary = ({ total, visible, withSession }: SummaryParams): string => {
  if (visible !== total) {
    return `${visible} of ${total}`;
  }
  const items = `${total} ${total === 1 ? 'item' : 'items'}`;
  return withSession === 0 ? items : `${items} · ${withSession} with a session`;
};

export const InboxStudio = ({
  workspaceId,
  rootPath,
  initialProvider = null,
  initialKind = null,
  initialRecordKey = null,
  initialSessionId = null,
  onClose,
}: Props) => {
  const { records, isLoading, loading, errors, connected, refetch } = useInboxRecords({
    workspaceId,
    rootPath,
  });
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<InboxFilters>(() =>
    initialFilters({ workspaceId, initialKind, initialProvider }),
  );
  const [selectedKey, setSelectedKey] = useState<string | null>(initialRecordKey);
  const [sessionFilter, setSessionFilter] = useState<SessionId | null>(initialSessionId);
  const [launchFocusRequest, setLaunchFocusRequest] = useState(0);
  const filteredSession = useSessionById(sessionFilter);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const detailRef = useRef<HTMLElement | null>(null);
  const body = useElementWidth();
  const isFacetFolded = body.width !== null && body.width - FACET_RAIL_PX < COLUMN_FOLD_PX;

  useEffect(() => {
    writeInboxFilters({ workspaceId, kind: filters.kind, source: filters.source });
  }, [workspaceId, filters.kind, filters.source]);

  const scopedRecords = useMemo(
    () =>
      sessionFilter == null
        ? records
        : records.filter((record) => recordSessionId({ record }) === sessionFilter),
    [records, sessionFilter],
  );

  const sessionFilterLabel = ((): string | null => {
    if (sessionFilter == null) {
      return null;
    }
    const goal =
      filteredSession == null ? '' : inlineMarkdownText({ text: filteredSession.goal }).trim();
    return goal === '' ? 'Linked session' : goal;
  })();

  const days = useMemo(
    () =>
      groupByDay({
        items: orderInboxRecords({
          records: filterInboxRecords({ records: scopedRecords, query, filters }),
        }),
        timestampOf: (record) => record.updatedAt,
        now: new Date(),
      }),
    [scopedRecords, query, filters],
  );
  const orderedRecords = days.flatMap((day) => day.items);
  const counts = inboxFacetCounts({ records: scopedRecords, query, filters });

  const selectedRecord = useMemo(
    () => scopedRecords.find((record) => record.key === selectedKey) ?? null,
    [scopedRecords, selectedKey],
  );

  const deselect = (): void => {
    setSelectedKey(null);
  };

  useEscapeLayer(deselect, selectedRecord != null);

  const selectKey = (key: string): void => {
    setSelectedKey(key);
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-inbox-key="${CSS.escape(key)}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    });
  };

  const activate = (key: string): void => {
    setSelectedKey(key);
    setLaunchFocusRequest((current) => current + 1);
  };

  const openSelected = (key: string | null): void => {
    const url = orderedRecords.find((record) => record.key === key)?.url ?? '';
    if (url === '') {
      return;
    }
    void openUrl(url);
  };

  const focusReply = (): void => {
    const composer = detailRef.current?.querySelector('textarea');
    composer?.focus();
  };

  useListKeys({
    keys: orderedRecords.map((record) => record.key),
    selectedKey,
    onSelect: selectKey,
    onActivate: activate,
    extraKeys: {
      o: openSelected,
      r: focusReply,
      '/': () => searchRef.current?.focus(),
    },
  });

  const clearFilters = (): void => {
    setQuery('');
    setFilters(NO_INBOX_FILTERS);
    setSessionFilter(null);
  };

  const hasFiltersActive =
    query.trim() !== '' || activeFilterCount({ filters }) > 0 || sessionFilter != null;

  const failures: ReadonlyArray<InboxLoadFailure> = INBOX_PROVIDERS.flatMap((provider) => {
    const message = errors[provider];
    return message == null ? [] : [{ provider, message }];
  });

  const openSettings = () => openToolSettings({});

  const facets = (
    <InboxFacetRail
      filters={filters}
      counts={counts}
      connected={connected}
      loading={loading}
      errors={errors}
      onFiltersChange={setFilters}
      onClearFilters={clearFilters}
    />
  );

  return (
    <StudioShell
      icon={CONCEPT_ICONS.inbox}
      tone={CONCEPT_TONE.inbox}
      title="Inbox"
      closeLabel="close inbox"
      isEscapeEnabled={selectedRecord == null}
      onClose={onClose}
    >
      {(requestClose) => (
        <InboxStudioLayout
          bodyRef={body.ref}
          rail={isFacetFolded ? null : facets}
          list={
            <PaneShell
              scroll="body"
              title={VIEW_TITLE[filters.view]}
              meta={summary({
                total: scopedRecords.length,
                visible: orderedRecords.length,
                withSession: scopedRecords.filter((record) => recordSessionId({ record }) != null)
                  .length,
              })}
              actions={
                <InboxListHeader
                  query={query}
                  onQueryChange={setQuery}
                  searchRef={searchRef}
                  sessionLabel={sessionFilterLabel}
                  onClearSession={() => setSessionFilter(null)}
                  isRefreshing={isLoading}
                  onRefresh={refetch}
                  isFacetFolded={isFacetFolded}
                  activeFilterCount={activeFilterCount({ filters })}
                  facets={facets}
                />
              }
            >
              <InboxList
                days={days}
                totalCount={scopedRecords.length}
                connectedCount={connected.length}
                isLoading={isLoading}
                failures={failures}
                hasFiltersActive={hasFiltersActive}
                selectedKey={selectedKey}
                onSelect={(record) => selectKey(record.key)}
                onRetry={refetch}
                onOpenSettings={openSettings}
                onClearFilters={clearFilters}
              />
            </PaneShell>
          }
          detail={
            selectedRecord == null ? null : (
              <aside
                ref={detailRef}
                aria-label="Inbox item"
                className="flex min-h-0 w-[440px] shrink-0 flex-col"
              >
                <InboxDetail
                  record={selectedRecord}
                  workspaceId={workspaceId}
                  rootPath={rootPath}
                  isLoading={isLoading}
                  errors={errors}
                  onRefresh={refetch}
                  onClose={requestClose}
                  onDeselect={deselect}
                  launchFocusRequest={launchFocusRequest}
                />
              </aside>
            )
          }
        />
      )}
    </StudioShell>
  );
};
