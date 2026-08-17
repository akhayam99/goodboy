import { Chip } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { CONCEPT_ICONS } from '../../../../../../shared/components/conceptIcons';
import { IntegrationGlyph } from '../../../../../integrations/components/IntegrationGlyph';
import type {
  TimelineIssueEntry,
  TimelinePlanEntry,
} from '../../../../timeline/buildTimelineEntries';
import { TimelineRail } from './TimelineRail';

type Props = {
  readonly entry: TimelinePlanEntry | TimelineIssueEntry;
  readonly sessionId: SessionId;
};

export const TimelineBand = ({ entry, sessionId }: Props) => {
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const setFocusedPlanId = useAppStore((s) => s.setFocusedPlanId);
  const openExternalTaskLens = useAppStore((s) => s.openExternalTaskLens);
  const PlanIcon = CONCEPT_ICONS.plans;

  if (entry.kind === 'issue') {
    return (
      <button
        type="button"
        onClick={() => openExternalTaskLens(sessionId, entry.task)}
        className="group flex min-h-9 w-full items-center gap-2 rounded-md border-l-2 border-info bg-muted px-2 py-1.5 text-left"
      >
        <span className="size-4 shrink-0" />
        <TimelineRail joinsPrevious={false} joinsNext={false} />
        <IntegrationGlyph provider={entry.task.provider} size="xs" />
        <span className="shrink-0 text-xs font-medium">{entry.task.identifier}</span>
        <span className="min-w-0 flex-1 truncate text-sm">{entry.task.title}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setFocusedPlanId(sessionId, entry.plan.id);
        setActiveLens(sessionId, 'plans');
      }}
      className="group flex min-h-9 w-full items-center gap-2 rounded-md border-l-2 border-success bg-muted px-2 py-1.5 text-left"
    >
      <span className="size-4 shrink-0" />
      <TimelineRail joinsPrevious={entry.joinsPrevious} joinsNext={entry.joinsNext} />
      <PlanIcon size={14} aria-hidden className="shrink-0 text-success" />
      <span className="min-w-0 flex-1 truncate text-sm">{entry.plan.title}</span>
      <Chip tone="neutral" label={entry.plan.status} size="xs" />
      {entry.plan.consumptionCount > 0 ? (
        <span className="shrink-0 text-2xs text-muted-foreground tabular-nums">
          {entry.plan.consumptionCount} consumers
        </span>
      ) : null}
    </button>
  );
};
