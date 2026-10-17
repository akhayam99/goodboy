import { Inbox, Mail, Zap, type LucideIcon } from 'lucide-react';
import {
  Eyebrow,
  SegmentedTabs,
  type SegmentedTabOption,
  FacetRail,
  FacetRow,
  FacetSection,
} from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { NotificationScope } from '../../../../store/slices/notifications/state';
import {
  NOTIFICATION_SEVERITY_FACETS,
  NOTIFICATION_VIEWS,
  type NotificationFacetCounts,
  type NotificationFilters,
  type NotificationSeverityFacet,
  type NotificationView,
} from '../../facets';
import { NOTIFICATION_SEVERITY } from '../../severity';
import { FacetCount } from './FacetCount';
import {
  NOTIFICATION_SOURCES,
  NOTIFICATION_SOURCE_LABEL,
  type NotificationSource,
} from '../../source';

type Props = {
  readonly filters: NotificationFilters;
  readonly counts: NotificationFacetCounts;
  readonly scope: NotificationScope;
  readonly workspaceName: string | null;
  readonly onFiltersChange: (filters: NotificationFilters) => void;
  readonly onScopeChange: (scope: NotificationScope) => void;
};

const VIEW_PRESENTATION = {
  all: { label: 'All', icon: Inbox },
  unread: { label: 'Unread', icon: Mail },
  action: { label: 'Needs action', icon: Zap },
} satisfies Record<NotificationView, { label: string; icon: LucideIcon }>;

const SEVERITY_LABEL = {
  error: 'Errors',
  warning: 'Warnings',
  info: 'Info',
} satisfies Record<NotificationSeverityFacet, string>;

const SOURCE_ICON = {
  agents: CONCEPT_ICONS.workflows,
  sessions: CONCEPT_ICONS.sessions,
  'pull-requests': CONCEPT_ICONS.pr,
  budget: CONCEPT_ICONS.budget,
  providers: CONCEPT_ICONS.providers,
  system: CONCEPT_ICONS.settings,
} satisfies Record<NotificationSource, LucideIcon>;

export const NotificationFacetRail = ({
  filters,
  counts,
  scope,
  workspaceName,
  onFiltersChange,
  onScopeChange,
}: Props) => {
  const scopeOptions: ReadonlyArray<SegmentedTabOption<NotificationScope>> = [
    {
      value: 'workspace',
      label: workspaceName ?? 'This workspace',
      ...(counts.workspace > 1 && {
        badge: <span className="tabular-nums text-faint-foreground">{counts.workspace}</span>,
      }),
    },
    {
      value: 'all',
      label: 'All',
      ...(counts.all > 1 && {
        badge: <span className="tabular-nums text-faint-foreground">{counts.all}</span>,
      }),
    },
  ];

  return (
    <FacetRail ariaLabel="Filter notifications">
      <FacetSection label="View">
        {NOTIFICATION_VIEWS.map((view) => (
          <FacetRow
            key={view}
            icon={VIEW_PRESENTATION[view].icon}
            label={VIEW_PRESENTATION[view].label}
            count={counts.view[view]}
            trailing={<FacetCount count={counts.view[view]} />}
            isSelected={filters.view === view}
            onClick={() => onFiltersChange({ ...filters, view })}
          />
        ))}
      </FacetSection>
      <FacetSection label="Severity">
        {NOTIFICATION_SEVERITY_FACETS.map((severity) => (
          <FacetRow
            key={severity}
            icon={NOTIFICATION_SEVERITY[severity].icon}
            tone={NOTIFICATION_SEVERITY[severity].tone}
            label={SEVERITY_LABEL[severity]}
            count={counts.severity[severity]}
            trailing={<FacetCount count={counts.severity[severity]} />}
            isSelected={filters.severity === severity}
            onClick={() =>
              onFiltersChange({
                ...filters,
                severity: filters.severity === severity ? null : severity,
              })
            }
          />
        ))}
      </FacetSection>
      <FacetSection label="Source">
        {NOTIFICATION_SOURCES.map((source) => (
          <FacetRow
            key={source}
            icon={SOURCE_ICON[source]}
            label={NOTIFICATION_SOURCE_LABEL[source]}
            count={counts.source[source]}
            trailing={<FacetCount count={counts.source[source]} />}
            isSelected={filters.source === source}
            onClick={() =>
              onFiltersChange({ ...filters, source: filters.source === source ? null : source })
            }
          />
        ))}
      </FacetSection>
      {workspaceName != null && (
        <section aria-label="Workspace" className="flex flex-col gap-2 px-2">
          <Eyebrow label="Workspace" muted />
          <SegmentedTabs
            ariaLabel="Notifications from"
            options={scopeOptions}
            value={scope}
            onChange={onScopeChange}
            size="sm"
            fill
          />
        </section>
      )}
    </FacetRail>
  );
};
