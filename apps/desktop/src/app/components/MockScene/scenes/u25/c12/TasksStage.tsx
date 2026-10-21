import { useEffect, useRef, useState, type ReactNode } from 'react';
import { PaneShell } from '@goodboy/ui';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../../shared/components/conceptIcons';
import { TaskFullPage } from '../../../../../../features/inbox/components/InboxStudio/TaskFullPage';
import { StudioShell } from '../../../../../../shared/components/StudioShell';
import { useAppStore } from '../../../../../../store';
import { InboxFacetRail } from '../../../../../../features/inbox/components/InboxStudio/InboxFacetRail';
import { InboxList } from '../../../../../../features/inbox/components/InboxStudio/InboxList';
import { InboxListHeader } from '../../../../../../features/inbox/components/InboxStudio/InboxListHeader';
import { InboxStudioLayout } from '../../../../../../features/inbox/components/InboxStudio/InboxStudioLayout';
import { TaskGroupRows } from '../../../../../../features/inbox/components/InboxStudio/TaskGroupRows';
import { integrationLabel } from '../../../../../../features/integrations/components/IntegrationGlyph';
import { isForMeRecord } from '../../../../../../features/inbox/isForMeRecord';
import {
  NO_INBOX_FILTERS,
  filterInboxRecords,
  inboxFacetCounts,
} from '../../../../../../features/inbox/kindFilter';
import { openCountWord } from '../../../../../../features/inbox/openCountWord';
import { taskGroupTotalsOf } from '../../../../../../features/inbox/taskGroupTotalsOf';
import { NAMES } from '../../../../../../shared/names';
import { sourceFailureLine } from '../../../../../../features/inbox/sourceFailureLine';
import { taskGroupsOf, type TaskGroupBy } from '../../../../../../features/inbox/taskGroups';
import type { TaskScope } from '../../../../../../features/inbox/taskListViewStorage';
import {
  INBOX_PROVIDERS,
  type InboxProvider,
  type InboxRecord,
} from '../../../../../../features/inbox/types';
import { seedBoardScene } from '../../BoardScene';
import { StudioFrame } from '../../StudioFrame';
import { StudioFrame as AppStudioFrame } from '../../../../StudioFrame';
import { seedStudioChrome } from '../../shellChrome';

const noop = () => undefined;

const NOT_LOADING: Readonly<Record<InboxProvider, boolean>> = {
  github: false,
  gitlab: false,
  linear: false,
  jira: false,
  sentry: false,
  slack: false,
  bitbucket: false,
};

type Props = {
  readonly records: ReadonlyArray<InboxRecord>;
  readonly scope: TaskScope;
  readonly groupBy: TaskGroupBy;
  readonly starredKeys?: ReadonlyArray<string>;
  readonly expandedKey?: string | null;
  readonly selectedKey?: string | null;
  readonly cursorKey?: string | null;
  readonly failures?: Partial<Record<InboxProvider, string>>;
  readonly query?: string;
  readonly lookup?: ReactNode;
  readonly drawer?: ReactNode;
  readonly full?: { readonly identifier: string; readonly page: ReactNode } | null;
  readonly connected?: ReadonlyArray<InboxProvider>;
  readonly onSeed?: () => void;
};

export const TasksStage = ({
  records,
  scope,
  groupBy,
  starredKeys = [],
  expandedKey = null,
  selectedKey = null,
  cursorKey = null,
  failures = {},
  query = '',
  lookup = null,
  drawer = null,
  full = null,
  connected = ['github', 'linear', 'jira', 'sentry', 'slack'],
  onSeed,
}: Props) => {
  const [isReady, setIsReady] = useState(false);
  const projects = useAppStore((state) => state.projects);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    seedBoardScene();
    seedStudioChrome();
    onSeed?.();
    setIsReady(true);
  }, [onSeed]);

  if (!isReady) {
    return null;
  }

  const isStarred = (record: InboxRecord): boolean => starredKeys.includes(record.key);
  const inScope =
    scope === 'all'
      ? records
      : records.filter((record) => isForMeRecord({ record, isStarred: isStarred(record) }));
  const projectNames = Object.fromEntries(
    projects.map((project) => [project.id, project.name] as const),
  );
  const matching = filterInboxRecords({
    records: inScope,
    query,
    filters: NO_INBOX_FILTERS,
    isStarred,
  });
  const starred = matching.filter(isStarred);
  const groups = taskGroupsOf({
    records: matching.filter((record) => !isStarred(record)),
    groupBy,
    projectNames,
  });
  const totals = taskGroupTotalsOf({ records: matching, groupBy, projectNames });
  const failing = INBOX_PROVIDERS.filter((provider) => failures[provider] !== undefined);
  const lineOf = (provider: InboxProvider) => ({
    key: provider,
    text: sourceFailureLine({
      name: integrationLabel({ provider }),
      message: failures[provider] ?? '',
    }),
    onRetry: noop,
  });
  const handlers = {
    selectedKey,
    cursorKey,
    onSelect: noop,
    onActivate: noop,
    starOf: isStarred,
    onToggleStar: noop,
    onCollapse: noop,
    onExpand: noop,
  };
  const facets = (
    <InboxFacetRail
      filters={NO_INBOX_FILTERS}
      counts={inboxFacetCounts({
        records: inScope,
        query: '',
        filters: NO_INBOX_FILTERS,
        isStarred,
      })}
      connected={connected}
      loading={NOT_LOADING}
      errors={{
        github: null,
        gitlab: null,
        linear: null,
        jira: null,
        sentry: null,
        slack: null,
        bitbucket: null,
      }}
      projects={projects}
      onFiltersChange={noop}
      onClearFilters={noop}
    />
  );
  const list = (
    <PaneShell
      scroll="body"
      title={NAMES.tasks}
      meta={openCountWord({ records: inScope })}
      actions={
        <InboxListHeader
          query={query}
          onQueryChange={noop}
          searchRef={searchRef}
          sessionLabel={null}
          onClearSession={noop}
          scope={scope}
          onScopeChange={noop}
          groupBy={groupBy}
          onGroupBy={noop}
          isRefreshing={false}
          onRefresh={noop}
          onManageTools={noop}
          activeFilterCount={0}
          facets={facets}
        />
      }
    >
      <InboxList
        totalCount={records.length}
        visibleCount={inScope.length}
        connectedCount={connected.length}
        failureCount={failing.length}
        isLoading={false}
        hasFiltersActive={false}
        onOpenSettings={noop}
        onClearFilters={noop}
      >
        {lookup}
        {groupBy === 'source' || failing.length === 0 ? null : (
          <TaskGroupRows
            label="Didn't load"
            records={[]}
            isExpanded={false}
            canCollapse={false}
            lines={failing.map(lineOf)}
            {...handlers}
          />
        )}
        {starred.length === 0 ? null : (
          <TaskGroupRows
            label="Starred"
            records={starred}
            isExpanded={expandedKey === 'starred'}
            canCollapse
            {...handlers}
          />
        )}
        {groups.map((group) => {
          const failed = failing.find((provider) => group.key === `source:${provider}`);
          return (
            <TaskGroupRows
              key={group.key}
              label={group.label}
              records={group.records}
              total={totals.get(group.key) ?? group.records.length}
              isExpanded={groupBy === 'none' || expandedKey === group.key}
              canCollapse={groupBy !== 'none'}
              lines={failed === undefined ? [] : [lineOf(failed)]}
              {...handlers}
            />
          );
        })}
      </InboxList>
    </PaneShell>
  );
  const page =
    full === null ? (
      list
    ) : (
      <TaskFullPage identifier={full.identifier} onBack={noop}>
        {full.page}
      </TaskFullPage>
    );

  return (
    <StudioFrame
      target={{ place: 'inbox', tool: null }}
      main={
        <AppStudioFrame kind="inbox" placement="content" onClose={noop}>
          <StudioShell
            icon={CONCEPT_ICONS.inbox}
            tone={CONCEPT_TONE.inbox}
            title={NAMES.tasks}
            closeLabel="Close tasks"
            onClose={noop}
          >
            {() => <InboxStudioLayout main={page} drawer={drawer} />}
          </StudioShell>
        </AppStudioFrame>
      }
    />
  );
};
