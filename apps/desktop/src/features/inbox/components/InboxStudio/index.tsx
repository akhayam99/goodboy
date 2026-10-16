import { openToolSettings } from '../../../integrations/openToolSettings';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { inlineMarkdownText, useEscapeLayer, PaneShell } from '@goodboy/ui';
import { NAMES } from '../../../../shared/names';
import type { SessionId, StarredIssue, WorkspaceId } from '@goodboy/types';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../shared/components/conceptIcons';
import { StudioShell } from '../../../../shared/components/StudioShell';
import { useListKeys } from '../../../../shared/hooks/useListKeys';
import { openUrl } from '../../../../shared/lib/editor';
import { useAppStore, useSessionById, type InboxStudioFocus } from '../../../../store';
import { useWorkspaceIssueLookup } from '../../../integrations/hooks/useWorkspaceIssueLookup';
import { integrationLabel } from '../../../integrations/components/IntegrationGlyph';
import { placeholderRecordOf } from '../../../integrations/starred/placeholderRecordOf';
import { recordSessionId } from '../../recordSessionId';
import { recordCanReply } from '../../recordCanReply';
import { useInboxRecords } from '../../useInboxRecords';
import { attachLinkedSession } from '../../attachLinkedSession';
import { useInboxLinkedSessions } from '../../useInboxLinkedSessions';
import { orderInboxRecords } from '../../orderInboxRecords';
import { isForMeRecord } from '../../isForMeRecord';
import { shownTaskRecords } from '../../shownTaskRecords';
import { sourceFailureLine } from '../../sourceFailureLine';
import { taskGroupsOf, type TaskGroup } from '../../taskGroups';
import { readTaskListView, writeTaskListView, type TaskListView } from '../../taskListViewStorage';
import { INBOX_PROVIDERS, type InboxKind, type InboxProvider, type InboxRecord } from '../../types';
import {
  NO_INBOX_FILTERS,
  activeFilterCount,
  filterInboxRecords,
  inboxFacetCounts,
  type InboxFilters,
  type InboxKindFilter,
} from '../../kindFilter';
import { readInboxFilters, writeInboxFilters } from '../../kindFilterStorage';
import { InboxDetail } from './InboxDetail';
import { InboxFacetRail } from './InboxFacetRail';
import { InboxList } from './InboxList';
import { InboxListHeader } from './InboxListHeader';
import { InboxLookupGroup } from './InboxLookupGroup';
import { InboxStarredGroup } from './InboxStarredGroup';
import { TaskFullPage } from './TaskFullPage';
import { TaskGroupRows, type TaskLine } from './TaskGroupRows';
import { useInboxStars } from '../../useInboxStars';
import { InboxStudioLayout } from './InboxStudioLayout';

const REPLY_FOCUS_FRAMES = 30;

const STARRED_GROUP_KEY = 'starred';

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

type InitialViewParams = {
  readonly workspaceId: WorkspaceId;
  readonly isDeepLinked: boolean;
};

const initialView = ({ workspaceId, isDeepLinked }: InitialViewParams): TaskListView => {
  const stored = readTaskListView({ workspaceId });
  return isDeepLinked ? { ...stored, scope: 'all' } : stored;
};

type OpenCountParams = {
  readonly records: ReadonlyArray<InboxRecord>;
};

const openCountWord = ({ records }: OpenCountParams): string =>
  `${records.filter((record) => record.state !== 'done').length.toLocaleString('en-US')} open`;

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
  const [view, setView] = useState<TaskListView>(() =>
    initialView({
      workspaceId,
      isDeepLinked: initialRecordKey !== null || initialSessionId !== null,
    }),
  );
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(initialRecordKey);
  const [fullKey, setFullKey] = useState<string | null>(null);
  const [cursorKey, setCursorKey] = useState<string | null>(initialRecordKey);
  const [sessionFilter, setSessionFilter] = useState<SessionId | null>(initialSessionId);
  const [launchFocusRequest, setLaunchFocusRequest] = useState(0);
  const [shouldLaunch, setShouldLaunch] = useState(false);
  const [replyFocusRequest, setReplyFocusRequest] = useState(0);
  const filteredSession = useSessionById(sessionFilter);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const detailRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    writeInboxFilters({ workspaceId, kind: filters.kind, source: filters.source });
  }, [workspaceId, filters.kind, filters.source]);

  const changeView = (next: TaskListView): void => {
    setView(next);
    setExpandedKey(null);
    writeTaskListView({ workspaceId, view: next });
  };

  const onFocusChangeRef = useRef(onFocusChange);
  onFocusChangeRef.current = onFocusChange;
  useEffect(() => {
    onFocusChangeRef.current?.({
      provider: filters.source,
      kind: initialKind,
      recordKey: openKey,
      sessionId: sessionFilter,
    });
  }, [filters.source, initialKind, openKey, sessionFilter]);

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
  const { isStarred, canStar, toggle: toggleStar } = stars;
  const [unstarredClosed, setUnstarredClosed] = useState<ReadonlyArray<StarredIssue>>([]);
  const inScope = useMemo(
    () =>
      view.scope === 'all'
        ? scopedRecords
        : scopedRecords.filter((record) => isForMeRecord({ record, isStarred: isStarred(record) })),
    [scopedRecords, view.scope, isStarred],
  );
  const projectNames = useMemo(
    () => Object.fromEntries(projects.map((project) => [project.id, project.name] as const)),
    [projects],
  );
  const groups = useMemo(
    () =>
      taskGroupsOf({
        records: filterInboxRecords({ records: inScope, query, filters, isStarred }).filter(
          (record) => !isStarred(record),
        ),
        groupBy: view.groupBy,
        projectNames,
      }),
    [inScope, query, filters, isStarred, view.groupBy, projectNames],
  );
  const starredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return stars.rows.filter((row) =>
      row.record === null
        ? needle === '' ||
          row.issue.identifier.toLowerCase().includes(needle) ||
          row.issue.title.toLowerCase().includes(needle)
        : filterInboxRecords({ records: [row.record], query, filters, isStarred }).length > 0,
    );
  }, [stars.rows, query, filters, isStarred]);
  const starredRecords = useMemo(
    () =>
      orderInboxRecords({
        records: starredRows.flatMap((row) => {
          if (row.record !== null) {
            return [row.record];
          }
          const placeholder = placeholderRecordOf(row.issue);
          return placeholder === null
            ? []
            : [attachLinkedSession({ record: placeholder, linked: linkedSessions })];
        }),
      }),
    [starredRows, linkedSessions],
  );
  const isGroupExpanded = (group: TaskGroup): boolean =>
    view.groupBy === 'none' || expandedKey === group.key;
  const shownStarred = shownTaskRecords({
    records: starredRecords,
    isExpanded: expandedKey === STARRED_GROUP_KEY,
  });
  const shownGroups = groups.map((group) =>
    shownTaskRecords({ records: group.records, isExpanded: isGroupExpanded(group) }),
  );
  const orderedRecords = [...shownStarred, ...shownGroups.flat()];
  const allListed = [...starredRecords, ...groups.flatMap((group) => group.records)];
  const counts = useMemo(
    () => inboxFacetCounts({ records: inScope, query, filters, isStarred }),
    [inScope, query, filters, isStarred],
  );

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
  const lookupRecords = useMemo(
    () =>
      lookup.state.status === 'done'
        ? lookup.state.value.result.hits.map((hit) =>
            attachLinkedSession({ record: hit.record, linked: linkedSessions }),
          )
        : [],
    [lookup.state, linkedSessions],
  );
  const orderedKeys = [...lookupRecords, ...orderedRecords].map((record) => record.key);

  const recordByKey = (key: string | null): InboxRecord | null =>
    key === null
      ? null
      : (scopedRecords.find((record) => record.key === key) ??
        starredRecords.find((record) => record.key === key) ??
        lookupRecords.find((record) => record.key === key) ??
        null);
  const openRecord = recordByKey(openKey);
  const fullRecord = recordByKey(fullKey);
  const activeCursorKey = cursorKey ?? orderedKeys[0] ?? null;
  const cursorRecord =
    openRecord?.key === activeCursorKey
      ? openRecord
      : ([...orderedRecords, ...lookupRecords, ...allListed].find(
          (record) => record.key === activeCursorKey,
        ) ?? null);
  const canReply = recordCanReply({ record: cursorRecord });

  const starOf = (record: InboxRecord): boolean | undefined =>
    canStar(record) ? isStarred(record) : undefined;

  const toggleSelectedStar = (key: string | null): void => {
    const record = [...orderedRecords, ...lookupRecords].find((entry) => entry.key === key);
    if (record !== undefined) {
      void toggleStar(record);
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
    setOpenKey(null);
  };

  const closeFull = (): void => {
    setFullKey(null);
  };

  useEscapeLayer(deselect, openRecord != null && fullRecord == null);
  useEscapeLayer(closeFull, fullRecord != null);

  const scrollToKey = useCallback((key: string): void => {
    requestAnimationFrame(() => {
      document
        .querySelector(`[data-row-key="${CSS.escape(key)}"]`)
        ?.scrollIntoView({ block: 'nearest' });
    });
  }, []);

  const moveCursor = useCallback(
    (key: string): void => {
      setCursorKey(key);
      setOpenKey((current) => (current === null ? null : key));
      scrollToKey(key);
    },
    [scrollToKey],
  );

  const openKeyed = useCallback(
    (key: string): void => {
      setCursorKey(key);
      setOpenKey(key);
      scrollToKey(key);
    },
    [scrollToKey],
  );

  const openKeyRef = useRef(openKey);
  openKeyRef.current = openKey;
  const activate = useCallback((key: string): void => {
    setCursorKey(key);
    if (openKeyRef.current !== key) {
      setOpenKey(key);
      return;
    }
    setShouldLaunch(true);
  }, []);

  const launch = useCallback((key: string): void => {
    setCursorKey(key);
    setOpenKey(key);
    setShouldLaunch(true);
  }, []);

  useEffect(() => {
    if (!shouldLaunch || openRecord === null) {
      return;
    }
    setShouldLaunch(false);
    setLaunchFocusRequest((current) => current + 1);
  }, [shouldLaunch, openRecord]);

  const selectRecord = useCallback((record: InboxRecord) => openKeyed(record.key), [openKeyed]);

  const launchRecord = useCallback((record: InboxRecord) => launch(record.key), [launch]);

  const toggleRecordStar = useCallback(
    (record: InboxRecord) => {
      void toggleStar(record);
    },
    [toggleStar],
  );

  const orderedRecordsRef = useRef(orderedRecords);
  orderedRecordsRef.current = orderedRecords;

  const openSelected = useCallback((key: string | null): void => {
    const url = orderedRecordsRef.current.find((record) => record.key === key)?.url ?? '';
    if (url === '') {
      return;
    }
    void openUrl(url);
  }, []);

  const activeCursorKeyRef = useRef(activeCursorKey);
  activeCursorKeyRef.current = activeCursorKey;
  const focusReply = useCallback((): void => {
    setOpenKey(activeCursorKeyRef.current);
    setReplyFocusRequest((current) => current + 1);
  }, []);

  useEffect(() => {
    if (replyFocusRequest === 0) {
      return;
    }
    let frame = 0;
    let attempts = 0;
    const focusComposer = (): void => {
      const composer = detailRef.current?.querySelector('textarea');
      if (composer != null) {
        composer.focus();
        return;
      }
      attempts += 1;
      if (attempts < REPLY_FOCUS_FRAMES) {
        frame = requestAnimationFrame(focusComposer);
      }
    };
    focusComposer();
    return () => cancelAnimationFrame(frame);
  }, [replyFocusRequest]);

  const focusSearch = useCallback((): void => {
    searchRef.current?.focus();
  }, []);

  const selectedStarRef = useRef(toggleSelectedStar);
  selectedStarRef.current = toggleSelectedStar;
  const starSelected = useCallback((key: string | null): void => {
    selectedStarRef.current(key);
  }, []);

  useListKeys({
    keys: fullRecord === null ? orderedKeys : [],
    selectedKey: activeCursorKey,
    onSelect: moveCursor,
    onActivate: activate,
    onOpenInTool: openSelected,
    ...(canReply && { onReply: focusReply }),
    onStar: starSelected,
    onSearch: focusSearch,
  });

  const clearFilters = (): void => {
    setQuery('');
    setFilters(NO_INBOX_FILTERS);
    setSessionFilter(null);
  };

  const hasFiltersActive =
    query.trim() !== '' || activeFilterCount({ filters }) > 0 || sessionFilter != null;

  const failingProviders = INBOX_PROVIDERS.filter((provider) => errors[provider] != null);
  const failureLineOf = (provider: InboxProvider): TaskLine => ({
    key: `failure:${provider}`,
    text: sourceFailureLine({
      name: integrationLabel({ provider }),
      message: errors[provider] ?? '',
    }),
    onClick: refetch,
  });
  const isSourceGrouped = view.groupBy === 'source';
  const failedSourceGroups = isSourceGrouped
    ? failingProviders.filter(
        (provider) => !groups.some((group) => group.key === `source:${provider}`),
      )
    : [];
  const looseFailures = isSourceGrouped ? [] : failingProviders.map(failureLineOf);

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

  const groupHandlers = {
    selectedKey: openKey,
    cursorKey: activeCursorKey,
    onSelect: selectRecord,
    onActivate: launchRecord,
    starOf,
    onToggleStar: toggleRecordStar,
  };

  const list = (
    <PaneShell
      scroll="body"
      title={NAMES.tasks}
      meta={openCountWord({ records: inScope })}
      actions={
        <InboxListHeader
          query={query}
          onQueryChange={setQuery}
          searchRef={searchRef}
          sessionLabel={sessionFilterLabel}
          onClearSession={() => setSessionFilter(null)}
          scope={view.scope}
          onScopeChange={(scope) => changeView({ ...view, scope })}
          groupBy={view.groupBy}
          onGroupBy={(groupBy) => changeView({ ...view, groupBy })}
          isRefreshing={isLoading}
          onRefresh={refetch}
          onManageTools={openSettings}
          activeFilterCount={activeFilterCount({ filters })}
          facets={facets}
        />
      }
    >
      <InboxList
        totalCount={scopedRecords.length}
        visibleCount={allListed.length + lookupRecords.length}
        connectedCount={connected.length}
        failureCount={failingProviders.length}
        isLoading={isLoading}
        hasFiltersActive={hasFiltersActive}
        onOpenSettings={openSettings}
        onClearFilters={clearFilters}
      >
        <InboxLookupGroup
          lookup={lookup}
          workspaceName={workspaceName}
          selectedKey={openKey}
          cursorKey={activeCursorKey}
          onSelect={(hit) => openKeyed(hit.record.key)}
          onActivate={launchRecord}
          starOf={starOf}
          onToggleStar={(record) => void toggleStar(record)}
        />
        {looseFailures.length > 0 ? (
          <TaskGroupRows
            label="Didn't load"
            records={[]}
            isExpanded={false}
            canCollapse={false}
            lines={looseFailures}
            onExpand={() => undefined}
            onCollapse={() => undefined}
            {...groupHandlers}
          />
        ) : null}
        <InboxStarredGroup
          rows={starredRows}
          records={starredRecords}
          isExpanded={expandedKey === STARRED_GROUP_KEY}
          selectedKey={openKey}
          cursorKey={activeCursorKey}
          unstarredCount={unstarredClosed.length}
          onExpand={() => setExpandedKey(STARRED_GROUP_KEY)}
          onCollapse={() => setExpandedKey(null)}
          onSelect={selectRecord}
          onActivate={launchRecord}
          onUnstar={(record) => {
            const row = stars.rows.find(
              (candidate) =>
                candidate.record?.key === record.key ||
                placeholderRecordOf(candidate.issue)?.key === record.key,
            );
            if (row === undefined) {
              return;
            }
            void unstarIssue({
              workspaceId,
              provider: row.issue.provider,
              externalId: row.issue.externalId,
            });
          }}
          onUnstarClosed={() => void unstarClosed()}
          onUndoUnstar={() => void undoUnstarClosed()}
        />
        {groups.map((group) => {
          const provider = group.key.startsWith('source:')
            ? failingProviders.find((candidate) => group.key === `source:${candidate}`)
            : undefined;
          return (
            <TaskGroupRows
              key={group.key}
              label={group.label}
              records={group.records}
              isExpanded={isGroupExpanded(group)}
              canCollapse={view.groupBy !== 'none'}
              lines={provider === undefined ? [] : [failureLineOf(provider)]}
              onExpand={() => setExpandedKey(group.key)}
              onCollapse={() => setExpandedKey(null)}
              {...groupHandlers}
            />
          );
        })}
        {failedSourceGroups.map((provider) => (
          <TaskGroupRows
            key={`source:${provider}`}
            label={integrationLabel({ provider })}
            records={[]}
            isExpanded={false}
            canCollapse={false}
            lines={[failureLineOf(provider)]}
            onExpand={() => undefined}
            onCollapse={() => undefined}
            {...groupHandlers}
          />
        ))}
      </InboxList>
    </PaneShell>
  );

  const fullPage = (requestClose: () => void) =>
    fullRecord === null ? null : (
      <TaskFullPage onBack={closeFull}>
        <InboxDetail
          record={fullRecord}
          workspaceId={workspaceId}
          rootPath={rootPath}
          errors={errors}
          onRefresh={refetch}
          onClose={requestClose}
          onDeselect={null}
          onOpenFull={null}
          star={
            canStar(fullRecord)
              ? { isStarred: isStarred(fullRecord), onToggle: () => void toggleStar(fullRecord) }
              : null
          }
          launchFocusRequest={0}
        />
      </TaskFullPage>
    );

  return (
    <StudioShell
      icon={CONCEPT_ICONS.inbox}
      tone={CONCEPT_TONE.inbox}
      title={NAMES.tasks}
      isEscapeEnabled={openRecord == null && fullRecord == null}
      onClose={onClose}
    >
      {(requestClose) => (
        <InboxStudioLayout
          main={fullPage(requestClose) ?? list}
          drawerRef={detailRef}
          drawer={
            openRecord == null || fullRecord !== null ? null : (
              <InboxDetail
                record={openRecord}
                workspaceId={workspaceId}
                rootPath={rootPath}
                errors={errors}
                onRefresh={refetch}
                onClose={requestClose}
                onDeselect={deselect}
                onOpenFull={() => {
                  setFullKey(openRecord.key);
                  setOpenKey(null);
                }}
                star={
                  canStar(openRecord)
                    ? {
                        isStarred: isStarred(openRecord),
                        onToggle: () => void toggleStar(openRecord),
                      }
                    : null
                }
                launchFocusRequest={launchFocusRequest}
              />
            )
          }
        />
      )}
    </StudioShell>
  );
};
