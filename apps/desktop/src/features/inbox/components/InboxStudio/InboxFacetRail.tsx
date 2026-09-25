import {
  Bug,
  CircleCheck,
  CircleDot,
  Contrast,
  GitPullRequest,
  Inbox,
  MessagesSquare,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { StatusDot } from '@goodboy/ui';
import { CONCEPT_ICONS, ICON_SIZE } from '../../../../shared/components/conceptIcons';
import { FacetRail } from '../../../../shared/components/FacetRail';
import {
  FacetKeyHints,
  type FacetKeyHint,
} from '../../../../shared/components/FacetRail/FacetKeyHints';
import { FacetRow } from '../../../../shared/components/FacetRail/FacetRow';
import { FacetSection } from '../../../../shared/components/FacetRail/FacetSection';
import {
  IntegrationGlyph,
  integrationLabel,
} from '../../../integrations/components/IntegrationGlyph';
import {
  INBOX_VIEWS,
  activeFilterCount,
  visibleTypeFacets,
  type InboxFacetCounts,
  type InboxFilters,
  type InboxTypeFacet,
  type InboxView,
} from '../../kindFilter';
import { INBOX_PROVIDERS, type InboxProvider } from '../../types';

type Props = {
  readonly filters: InboxFilters;
  readonly counts: InboxFacetCounts;
  readonly connected: ReadonlyArray<InboxProvider>;
  readonly loading: Readonly<Record<InboxProvider, boolean>>;
  readonly errors: Readonly<Record<InboxProvider, string | null>>;
  readonly onFiltersChange: (filters: InboxFilters) => void;
  readonly onClearFilters: () => void;
};

type Presentation = {
  readonly label: string;
  readonly icon: LucideIcon;
};

const VIEW_PRESENTATION = {
  all: { label: 'All', icon: Inbox },
  'in-progress': { label: 'In progress', icon: Contrast },
  'with-session': { label: 'With a session', icon: CONCEPT_ICONS.sessions },
  closed: { label: 'Closed', icon: CircleCheck },
} satisfies Record<InboxView, Presentation>;

const TYPE_PRESENTATION = {
  issue: { label: 'Issues', icon: CircleDot },
  'pr-mr': { label: 'Pull requests', icon: GitPullRequest },
  thread: { label: 'Threads', icon: MessagesSquare },
  error: { label: 'Errors', icon: Bug },
} satisfies Record<InboxTypeFacet, Presentation>;

const INBOX_KEY_HINTS = [
  { keys: ['j', 'k'], label: 'Next or previous' },
  { keys: ['↵'], label: 'Launch or open session' },
  { keys: ['o'], label: 'Open in the tool' },
  { keys: ['r'], label: 'Reply' },
  { keys: ['/'], label: 'Search' },
] satisfies ReadonlyArray<FacetKeyHint>;

type SourceTrailingParams = {
  readonly isLoading: boolean;
  readonly error: string | null;
};

const sourceTrailing = ({ isLoading, error }: SourceTrailingParams) => {
  if (error != null) {
    return (
      <span className="flex shrink-0 items-center gap-1 text-3xs text-faint-foreground">
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
  onFiltersChange,
  onClearFilters,
}: Props) => {
  const types = visibleTypeFacets({ connected });
  const sources = INBOX_PROVIDERS.filter(
    (provider) => connected.includes(provider) || filters.source === provider,
  );
  const hasActiveFilter = activeFilterCount({ filters }) > 0;

  return (
    <FacetRail ariaLabel="Filter the inbox">
      <FacetSection label="View">
        {INBOX_VIEWS.map((view) => (
          <FacetRow
            key={view}
            icon={VIEW_PRESENTATION[view].icon}
            label={VIEW_PRESENTATION[view].label}
            count={counts.view[view]}
            isSelected={filters.view === view}
            onClick={() =>
              onFiltersChange({
                ...filters,
                view: filters.view === view && view !== 'all' ? 'all' : view,
              })
            }
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
              isSelected={filters.kind === type}
              onClick={() =>
                onFiltersChange({ ...filters, kind: filters.kind === type ? 'all' : type })
              }
            />
          ))}
        </FacetSection>
      ) : null}
      {sources.length > 0 ? (
        <FacetSection label="Source">
          {sources.map((provider) => (
            <FacetRow
              key={provider}
              glyph={<IntegrationGlyph provider={provider} size="xs" useBrandColor />}
              label={integrationLabel({ provider })}
              count={counts.source[provider]}
              trailing={sourceTrailing({
                isLoading: loading[provider],
                error: errors[provider],
              })}
              isSelected={filters.source === provider}
              onClick={() =>
                onFiltersChange({
                  ...filters,
                  source: filters.source === provider ? null : provider,
                })
              }
            />
          ))}
        </FacetSection>
      ) : null}
      <FacetKeyHints hints={INBOX_KEY_HINTS} />
      {hasActiveFilter ? (
        <button
          type="button"
          onClick={onClearFilters}
          className="self-start rounded-md px-2 py-1 text-2xs text-muted-foreground hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          Clear filters
        </button>
      ) : null}
    </FacetRail>
  );
};
