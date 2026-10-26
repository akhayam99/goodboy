import {
  Bug,
  CircleCheck,
  CircleDot,
  Contrast,
  GitPullRequest,
  Inbox,
  MessagesSquare,
  Star,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import type { Project } from '@goodboy/types';
import { Button, FacetRail, FacetRow, FacetSection, ICON_SIZE, StatusDot } from '@goodboy/ui';
import { NAMES } from '../../../../shared/utils/names';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import { IntegrationGlyph } from '../../../integrations/components/IntegrationGlyph';
import { integrationLabel } from '../../../../shared/utils/integrationLabel';
import {
  activeFilterCount,
  visibleTypeFacets,
  type InboxFacetCounts,
  type InboxFilters,
  type InboxTypeFacet,
  type InboxView,
} from '../../kindFilter';
import { INBOX_PROVIDERS, type InboxProvider } from '../../types';
import { InboxProjectFacets } from './InboxProjectFacets';
import { projectFilterNote, projectFilterScope } from '../../projectFilterScope';

type Props = {
  readonly filters: InboxFilters;
  readonly counts: InboxFacetCounts;
  readonly connected: ReadonlyArray<InboxProvider>;
  readonly loading: Readonly<Record<InboxProvider, boolean>>;
  readonly errors: Readonly<Record<InboxProvider, string | null>>;
  readonly projects?: ReadonlyArray<Project>;
  readonly onFiltersChange: (filters: InboxFilters) => void;
  readonly onClearFilters: () => void;
};

type Presentation = {
  readonly label: string;
  readonly icon: LucideIcon;
};

const VIEW_PRESENTATION = {
  all: { label: 'All', icon: Inbox },
  starred: { label: 'Starred', icon: Star },
  'in-progress': { label: 'In progress', icon: Contrast },
  'with-session': { label: NAMES.hasASession, icon: CONCEPT_ICONS.sessions },
  closed: { label: 'Closed', icon: CircleCheck },
} satisfies Record<Exclude<InboxView, 'assigned'>, Presentation>;

const SHOWN_VIEWS: ReadonlyArray<Exclude<InboxView, 'all' | 'assigned'>> = [
  'starred',
  'in-progress',
  'with-session',
  'closed',
];

const TYPE_PRESENTATION = {
  issue: { label: 'Issues', icon: CircleDot },
  'pr-mr': { label: 'Pull requests', icon: GitPullRequest },
  thread: { label: 'Threads', icon: MessagesSquare },
  error: { label: 'Errors', icon: Bug },
} satisfies Record<InboxTypeFacet, Presentation>;

type SourceTrailingParams = {
  readonly isLoading: boolean;
  readonly error: string | null;
};

type ZeroParams = {
  readonly count: number;
};

const ZERO_COUNT = <span aria-hidden />;

const zeroTrailing = ({ count }: ZeroParams) => (count === 0 ? ZERO_COUNT : undefined);

const sourceTrailing = ({ isLoading, error }: SourceTrailingParams) => {
  if (error != null) {
    return (
      <span className="flex shrink-0 items-center gap-1 text-chip text-faint-foreground">
        <TriangleAlert size={ICON_SIZE.row} aria-hidden className="text-warning" />
        Didn&apos;t load
      </span>
    );
  }
  if (isLoading) {
    return <StatusDot tone="neutral" size="sm" pulsing ariaLabel="Loading" role="status" />;
  }
  return undefined;
};

export const InboxFacetRail = ({
  filters,
  counts,
  connected,
  loading,
  errors,
  projects = [],
  onFiltersChange,
  onClearFilters,
}: Props) => {
  const types = visibleTypeFacets({ connected });
  const sources = INBOX_PROVIDERS.filter(
    (provider) => connected.includes(provider) || filters.source === provider,
  );
  const hasActiveFilter = activeFilterCount({ filters }) > 0;
  const scope = projectFilterScope({ connected, filters });
  const isProjectFacetShown =
    scope.mapped.length > 0 &&
    projects.length > 1 &&
    (counts.hasProjectMapping || filters.project != null);
  const change = (next: InboxFilters) => {
    const nextScope = projectFilterScope({ connected, filters: next });
    onFiltersChange(nextScope.mapped.length === 0 ? { ...next, project: null } : next);
  };

  return (
    <FacetRail ariaLabel="Filter tasks">
      {sources.length > 0 ? (
        <FacetSection label="Source">
          {sources.map((provider) => (
            <FacetRow
              key={provider}
              glyph={<IntegrationGlyph provider={provider} size="xs" useBrandColor />}
              label={integrationLabel({ provider })}
              count={counts.source[provider]}
              trailing={
                sourceTrailing({
                  isLoading: loading[provider],
                  error: errors[provider],
                }) ?? zeroTrailing({ count: counts.source[provider] })
              }
              isSelected={filters.source === provider}
              onClick={() =>
                change({
                  ...filters,
                  source: filters.source === provider ? null : provider,
                })
              }
            />
          ))}
        </FacetSection>
      ) : null}
      <FacetSection label="Show">
        {SHOWN_VIEWS.map((view) => (
          <FacetRow
            key={view}
            icon={VIEW_PRESENTATION[view].icon}
            label={VIEW_PRESENTATION[view].label}
            count={counts.view[view]}
            trailing={zeroTrailing({ count: counts.view[view] })}
            isSelected={filters.view === view}
            onClick={() => change({ ...filters, view: filters.view === view ? 'all' : view })}
          />
        ))}
      </FacetSection>
      {types.length > 0 ? (
        <FacetSection label="Type">
          {types.map((type) => (
            <FacetRow
              key={type}
              icon={TYPE_PRESENTATION[type].icon}
              label={TYPE_PRESENTATION[type].label}
              count={counts.kind[type]}
              trailing={zeroTrailing({ count: counts.kind[type] })}
              isSelected={filters.kind === type}
              onClick={() => change({ ...filters, kind: filters.kind === type ? 'all' : type })}
            />
          ))}
        </FacetSection>
      ) : null}
      {isProjectFacetShown ? (
        <InboxProjectFacets
          projects={projects}
          filters={filters}
          counts={counts}
          note={filters.project == null ? null : projectFilterNote({ scope })}
          onFiltersChange={change}
        />
      ) : null}
      {hasActiveFilter ? (
        <div className="flex px-2">
          <Button variant="ghost" size="xs" onClick={onClearFilters}>
            Clear filters
          </Button>
        </div>
      ) : null}
    </FacetRail>
  );
};
