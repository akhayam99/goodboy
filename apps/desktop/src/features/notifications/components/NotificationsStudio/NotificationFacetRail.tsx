import { Inbox, Mail, Zap, type LucideIcon } from 'lucide-react';
import { Eyebrow, PANE_RHYTHM, SegmentedTabs, cn, type SegmentedTabOption } from '@goodboy/ui';
import { CONCEPT_ICONS } from '../../../../shared/components/conceptIcons';
import type { NotificationScope } from '../../../../store/types';
import {
  NOTIFICATION_SEVERITY_FACETS,
  NOTIFICATION_VIEWS,
  type NotificationFacetCounts,
  type NotificationFilters,
  type NotificationSeverityFacet,
  type NotificationView,
} from '../../facets';
import { NOTIFICATION_SEVERITY } from '../../severity';
import {
  NOTIFICATION_SOURCES,
  NOTIFICATION_SOURCE_LABEL,
  type NotificationSource,
} from '../../source';
import { NotificationFacetRow } from './NotificationFacetRow';
import { NotificationKeyHints } from './NotificationKeyHints';

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
      badge: <span className="tabular-nums text-faint-foreground">{counts.workspace}</span>,
    },
    {
      value: 'all',
      label: 'All',
      badge: <span className="tabular-nums text-faint-foreground">{counts.all}</span>,
    },
  ];

  return (
    <nav
      aria-label="Filter notifications"
      className={cn('flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto', PANE_RHYTHM.navRail.body)}
    >
      <section aria-label="View" className="flex flex-col gap-0.5">
        <Eyebrow label="View" muted className="px-2 pb-1" />
        {NOTIFICATION_VIEWS.map((view) => (
          <NotificationFacetRow
            key={view}
            icon={VIEW_PRESENTATION[view].icon}
            label={VIEW_PRESENTATION[view].label}
            count={counts.view[view]}
            isSelected={filters.view === view}
            onClick={() => onFiltersChange({ ...filters, view })}
          />
        ))}
      </section>
      <section aria-label="Severity" className="flex flex-col gap-0.5">
        <Eyebrow label="Severity" muted className="px-2 pb-1" />
        {NOTIFICATION_SEVERITY_FACETS.map((severity) => (
          <NotificationFacetRow
            key={severity}
            icon={NOTIFICATION_SEVERITY[severity].icon}
            tone={NOTIFICATION_SEVERITY[severity].tone}
            label={SEVERITY_LABEL[severity]}
            count={counts.severity[severity]}
            isSelected={filters.severity === severity}
            onClick={() =>
              onFiltersChange({
                ...filters,
                severity: filters.severity === severity ? null : severity,
              })
            }
          />
        ))}
      </section>
      <section aria-label="Source" className="flex flex-col gap-0.5">
        <Eyebrow label="Source" muted className="px-2 pb-1" />
        {NOTIFICATION_SOURCES.map((source) => (
          <NotificationFacetRow
            key={source}
            icon={SOURCE_ICON[source]}
            label={NOTIFICATION_SOURCE_LABEL[source]}
            count={counts.source[source]}
            isSelected={filters.source === source}
            onClick={() =>
              onFiltersChange({ ...filters, source: filters.source === source ? null : source })
            }
          />
        ))}
      </section>
      {workspaceName != null && (
        <section aria-label="Workspace" className="flex flex-col gap-1.5 px-2">
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
      <NotificationKeyHints />
    </nav>
  );
};
