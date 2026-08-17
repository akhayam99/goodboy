import { GitBranch } from 'lucide-react';
import { tintClasses } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../../shared/components/conceptIcons';
import { IntegrationGlyph } from '../../../../../integrations/components/IntegrationGlyph';
import type {
  TimelineBranchEntry,
  TimelineIssueEntry,
  TimelinePlanEntry,
} from '../../../../timeline/buildTimelineGroups';

type Props = {
  readonly entry: TimelinePlanEntry | TimelineIssueEntry | TimelineBranchEntry;
  readonly sessionId: SessionId;
  readonly timeLabel: string | null;
};

export const TimelineArtifactRow = ({ entry, sessionId, timeLabel }: Props) => {
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const setFocusedPlanId = useAppStore((s) => s.setFocusedPlanId);
  const openExternalTaskLens = useAppStore((s) => s.openExternalTaskLens);
  const Icon =
    entry.kind === 'plan' ? CONCEPT_ICONS.plans : entry.kind === 'branch' ? GitBranch : null;
  const planTint = tintClasses(CONCEPT_TONE.plans);
  const title =
    entry.kind === 'plan'
      ? entry.plan.title
      : entry.kind === 'issue'
        ? `${entry.task.identifier}: ${entry.task.title}`
        : 'Branch created';
  const meta =
    entry.kind === 'plan'
      ? `${entry.plan.status}${entry.plan.consumptionCount > 0 ? ` · ${entry.plan.consumptionCount} consumers` : ''}`
      : entry.kind === 'branch'
        ? entry.worktree.branch
        : null;
  const open = () => {
    if (entry.kind === 'plan') {
      setFocusedPlanId(sessionId, entry.plan.id);
      setActiveLens(sessionId, 'plans');
      return;
    }
    if (entry.kind === 'issue') {
      openExternalTaskLens(sessionId, entry.task);
      return;
    }
    setActiveLens(sessionId, 'files');
  };

  return (
    <div className="grid min-h-9 grid-cols-[44px_24px_minmax(0,1fr)]">
      <span className="self-center text-right text-3xs tabular-nums text-muted-foreground">
        {timeLabel}
      </span>
      <div className="relative flex items-center justify-center">
        <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border" />
        <span className="relative z-10 flex size-4 items-center justify-center rounded-full bg-elevated ring-1 ring-border">
          {entry.kind === 'issue' ? (
            <IntegrationGlyph provider={entry.task.provider} size="xs" />
          ) : Icon != null ? (
            <Icon
              size={10}
              aria-hidden
              className={entry.kind === 'plan' ? planTint.icon : 'text-muted-foreground'}
            />
          ) : null}
        </span>
      </div>
      <button
        type="button"
        onClick={open}
        className="flex min-w-0 items-center gap-2 py-1.5 text-left"
      >
        <span className="truncate text-sm text-foreground">{title}</span>
        {meta != null ? (
          <span className="shrink-0 text-xs font-medium text-muted-foreground">{meta}</span>
        ) : null}
      </button>
    </div>
  );
};
