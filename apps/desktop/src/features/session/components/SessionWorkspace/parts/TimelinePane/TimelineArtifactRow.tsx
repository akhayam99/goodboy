import { GitBranch } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../../store';
import { CONCEPT_ICONS, CONCEPT_TONE } from '../../../../../../shared/components/conceptIcons';
import { IntegrationGlyph } from '../../../../../integrations/components/IntegrationGlyph';
import type {
  TimelineBranchEntry,
  TimelineIssueEntry,
  TimelinePlanEntry,
} from '../../../../timeline/buildTimelineGroups';
import type { RunIdentity } from '../../../../timeline/runIdentity';
import { TimelineGlyphMarker } from './TimelineGlyphMarker';
import { TimelineMarker } from './TimelineMarker';
import type { TimelineDepth } from '../../../../timeline/flattenTimelineRows';
import { TimelineRow } from './TimelineRow';

type ArtifactEntry = TimelinePlanEntry | TimelineIssueEntry | TimelineBranchEntry;

type Props = {
  readonly entry: ArtifactEntry;
  readonly sessionId: SessionId;
  readonly timeLabel: string | null;
  readonly indent: TimelineDepth;
  readonly identity: RunIdentity | null;
};

type MarkerParams = {
  readonly entry: ArtifactEntry;
};

const markerFor = ({ entry }: MarkerParams) => {
  if (entry.kind === 'issue') {
    return (
      <TimelineMarker tone="neutral">
        <IntegrationGlyph provider={entry.task.provider} size="xs" />
      </TimelineMarker>
    );
  }
  if (entry.kind === 'plan') {
    return (
      <TimelineGlyphMarker icon={CONCEPT_ICONS.plans} tone={CONCEPT_TONE.plans} ariaLabel="Plan" />
    );
  }
  return <TimelineGlyphMarker icon={GitBranch} tone="neutral" ariaLabel="Branch" />;
};

export const TimelineArtifactRow = ({ entry, sessionId, timeLabel, indent, identity }: Props) => {
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
      indent={indent}
      identity={identity}
      marker={markerFor({ entry })}
      label={<span className="min-w-0 truncate text-sm text-foreground">{title}</span>}
      meta={meta}
      navigation={{
        label:
          entry.kind === 'plan'
            ? 'Open plan'
            : entry.kind === 'issue'
              ? `Open ${entry.task.identifier}`
              : 'Open files',
        onNavigate: open,
      }}
    />
  );
};
