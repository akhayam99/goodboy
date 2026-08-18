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
import { TimelineRow } from './TimelineRow';

type Props = {
  readonly entry: TimelinePlanEntry | TimelineIssueEntry | TimelineBranchEntry;
  readonly sessionId: SessionId;
  readonly timeLabel: string | null;
  readonly hasRoleColumn?: boolean;
};

type MarkerParams = {
  readonly entry: TimelinePlanEntry | TimelineIssueEntry | TimelineBranchEntry;
};

const markerFor = ({ entry }: MarkerParams) => {
  if (entry.kind === 'issue') {
    return <IntegrationGlyph provider={entry.task.provider} size="xs" />;
  }
  const planTint = tintClasses(CONCEPT_TONE.plans);
  if (entry.kind === 'plan') {
    return <CONCEPT_ICONS.plans size={10} aria-hidden className={planTint.icon} />;
  }
  return <GitBranch size={10} aria-hidden className="text-muted-foreground" />;
};

export const TimelineArtifactRow = ({
  entry,
  sessionId,
  timeLabel,
  hasRoleColumn = false,
}: Props) => {
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const setFocusedPlanId = useAppStore((s) => s.setFocusedPlanId);
  const openExternalTaskLens = useAppStore((s) => s.openExternalTaskLens);
  const title =
    entry.kind === 'plan'
      ? entry.plan.title
      : entry.kind === 'issue'
        ? `${entry.task.identifier}: ${entry.task.title}`
        : 'Branch created';
  const meta =
    entry.kind === 'plan'
      ? entry.plan.status
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
    <TimelineRow
      timeLabel={timeLabel}
      depth={entry.depth}
      hasRoleColumn={hasRoleColumn}
      marker={markerFor({ entry })}
      onClick={open}
      ariaLabel={
        entry.kind === 'plan'
          ? `open plan ${title}`
          : entry.kind === 'issue'
            ? `open ${entry.task.identifier}`
            : `open ${title}`
      }
      label={<span className="min-w-0 truncate text-sm text-foreground">{title}</span>}
      meta={
        meta != null ? (
          <span className="text-xs font-medium text-muted-foreground">{meta}</span>
        ) : null
      }
    />
  );
};
