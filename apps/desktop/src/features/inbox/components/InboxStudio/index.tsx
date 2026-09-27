import { openToolSettings } from '../../../integrations/openToolSettings';
import { useEffect, useMemo, useRef, useState } from 'react';
import { inlineMarkdownText, useEscapeLayer } from '@goodboy/ui';
import type { SessionId, StarredIssue, WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { PaneShell } from '../../../../shared/components/PaneShell';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { useElementWidth } from '../../../../shared/hooks/useElementWidth';
import { useListKeys } from '../../../../shared/hooks/useListKeys';
import { openUrl } from '../../../../shared/lib/editor';
import { groupByDay } from '../../../../shared/utils/groupByDay';
import { useAppStore, useSessionById, type InboxStudioFocus } from '../../../../store';
import { useWorkspaceIssueLookup } from '../../../integrations/hooks/useWorkspaceIssueLookup';
import { placeholderRecordOf } from '../../../integrations/starred/placeholderRecordOf';
import { recordSessionId } from '../../recordSessionId';
import { useInboxRecords } from '../../useInboxRecords';
import { attachLinkedSession } from '../../attachLinkedSession';
import { useInboxLinkedSessions } from '../../useInboxLinkedSessions';
import { orderInboxRecords } from '../../orderInboxRecords';
import { INBOX_PROVIDERS, type InboxKind, type InboxProvider, type InboxRecord } from '../../types';
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
import { InboxLookupGroup } from './InboxLookupGroup';
import { InboxStarredGroup } from './InboxStarredGroup';
import type { InboxRowStar } from './InboxRow';
import { useInboxStars } from '../../useInboxStars';
import { InboxStudioLayout } from './InboxStudioLayout';

type Props = {
  readonly workspaceId: WorkspaceId;
  readonly rootPath: string;
  readonly initialProvider?: InboxProvider | null;
  readonly initialKind?: InboxKind | null;
  readonly initialRecordKey?: string | null;
  readonly initialSessionId?: SessionId | null;
  readonly onFocusChange?: (focus: InboxStudioFocus) => void;
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
    project: null,
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
  onFocusChange,
  onClose,
}: Props) => {
  const {
    records: fetchedRecords,
    isLoading,
    loading,
    errors,
    connected,
    projects,
    refetch,
  } = useInboxRecords({
    workspaceId,
    rootPath,
  });
  const linkedSessions = useInboxLinkedSessions({ workspaceId });
  const records = useMemo(
    () => fetchedRecords.map((record) => attachLinkedSession({ record, linked: linkedSessions })),
    [fetchedRecords, linkedSessions],
  );
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

  const onFocusChangeRef = useRef(onFocusChange);
  onFocusChangeRef.current = onFocusChange;
  useEffect(() => {
    onFocusChangeRef.current?.({
      provider: filters.source,
      kind: initialKind,
      recordKey: selectedKey,
      sessionId: sessionFilter,
    });
  }, [filters.source, initialKind, selectedKey, sessionFilter]);

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

  const stars = useInboxStars({ workspaceId, records });
  const [unstarredClosed, setUnstarredClosed] = useState<ReadonlyArray<StarredIssue>>([]);
  const days = useMemo(
    () =>
      groupByDay({
        items: orderInboxRecords({
          records: filterInboxRecords({ records: scopedRecords, query, filters }).filter(
            (record) => !stars.isStarred(record),
          ),
        }),
        timestampOf: (record) => record.updatedAt,
        now: new Date(),
      }),
    [scopedRecords, query, filters, stars.isStarred],
  );
  const needle = query.trim().toLowerCase();
  const starredRows = stars.rows.filter((row) =>
    row.record === null
      ? needle === '' ||
        row.issue.identifier.toLowerCase().includes(needle) ||
        row.issue.title.toLowerCase().includes(needle)
      : filterInboxRecords({ records: [row.record], query, filters }).length > 0,
  );
  const starredRecords = starredRows.flatMap((row) => {
    if (row.record !== null) {
      return [row.record];
    }
    const placeholder = placeholderRecordOf(row.issue);
    return placeholder === null
      ? []
      : [attachLinkedSession({ record: placeholder, linked: linkedSessions })];
  });
  const orderedRecords = [...starredRecords, ...days.flatMap((day) => day.items)];
  const counts = inboxFacetCounts({ records: scopedRecords, query, filters });

  const workspaceName = useAppStore(
    (state) => state.workspaces.find((workspace) => workspace.id === workspaceId)?.name ?? '',
  );
  const unstarIssue = useAppStore((state) => state.unstarIssue);
  const unstarClosedIssues = useAppStore((state) => state.unstarClosedIssues);
  const restoreStarredIssues = useAppStore((state) => state.restoreStarredIssues);
  const reportError = useAppStore((state) => state.reportError);
  const lookup = useWorkspaceIssueLookup({
    workspaceId,
    query,
    isKnown: (code) => records.some((record) => record.identifier.toUpperCase() === code),
  });
  const lookupRecords =
    lookup.state.status === 'done'
      ? lookup.state.value.result.hits.map((hit) =>
          attachLinkedSession({ record: hit.record, linked: linkedSessions }),
        )
      : [];

  const selectedRecord =
    scopedRecords.find((record) => record.key === selectedKey) ??
    starredRecords.find((record) => record.key === selectedKey) ??
    lookupRecords.find((record) => record.key === selectedKey) ??
    null;

  const starOf = (record: InboxRecord): InboxRowStar | undefined =>
    stars.canStar(record)
      ? { isStarred: stars.isStarred(record), onToggle: () => void stars.toggle(record) }
      : undefined;

  const toggleSelectedStar = (key: string | null): void => {
    const record = [...orderedRecords, ...lookupRecords].find((entry) => entry.key === key);
    if (record !== undefined) {
      void stars.toggle(record);
    }
  };

  const unstarClosed = async (): Promise<void> => {
    try {
      setUnstarredClosed(await unstarClosedIssues({ workspaceId }));
    } catch (error) {
      void reportError({ title: "Couldn't unstar the closed issues", error, workspaceId });
    }
  };

  const undoUnstarClosed = async (): Promise<void> => {
    const issues = unstarredClosed;
    setUnstarredClosed([]);
    await restoreStarredIssues({ workspaceId, issues }).catch(() => undefined);
  };

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
      s: toggleSelectedStar,
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
      projects={projects}
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
              <InboxLookupGroup
                lookup={lookup}
                workspaceName={workspaceName}
                selectedKey={selectedKey}
                onSelect={(hit) => selectKey(hit.record.key)}
                starOf={starOf}
              />
              <InboxStarredGroup
                rows={starredRows}
                selectedKey={selectedKey}
                unstarredCount={unstarredClosed.length}
                onSelect={(record) => selectKey(record.key)}
                onUnstar={(row) =>
                  void unstarIssue({
                    workspaceId,
                    provider: row.issue.provider,
                    externalId: row.issue.externalId,
                  })
                }
                onUnstarClosed={() => void unstarClosed()}
                onUndoUnstar={() => void undoUnstarClosed()}
              />
              <InboxList
                days={days}
                starOf={starOf}
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
          drawerRef={detailRef}
          drawer={
            selectedRecord == null ? null : (
              <InboxDetail
                record={selectedRecord}
                workspaceId={workspaceId}
                rootPath={rootPath}
                errors={errors}
                onRefresh={refetch}
                onClose={requestClose}
                onDeselect={deselect}
                launchFocusRequest={launchFocusRequest}
              />
            )
          }
        />
      )}
    </StudioShell>
  );
};
