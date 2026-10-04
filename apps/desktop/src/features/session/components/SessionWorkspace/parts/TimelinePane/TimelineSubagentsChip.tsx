import { ChevronDown } from 'lucide-react';
import { cn, tintClasses } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';
import type { TimelineRowSubagents } from '../../../../timeline/buildTimelineStream';
import { subagentsLabel } from '../../../../timeline/subagentSummary';

type Props = {
  readonly subagents: TimelineRowSubagents;
  readonly isExpanded: boolean;
  readonly onSet: (params: { readonly id: string; readonly isExpanded: boolean }) => void;
};

export const TimelineSubagentsChip = ({ subagents, isExpanded, onSet }: Props) => {
  const { summary, id } = subagents;
  const failed = summary.failedCount;
  const asking = summary.attentionCount - failed;
  const tone = failed > 0 ? 'danger' : asking > 0 ? 'warning' : null;
  const attention =
    failed > 0
      ? `${failed} failed`
      : asking > 0
        ? `${asking} ${asking === 1 ? 'needs' : 'need'} you`
        : null;
  const label = subagentsLabel({ total: summary.total });
  return (
    <button
      type="button"
      data-testid="timeline-subagents-chip"
      aria-expanded={isExpanded}
      aria-label={isExpanded ? `Hide ${label}` : `Show ${label}`}
      onClick={() => onSet({ id, isExpanded: !isExpanded })}
      className={cn(
        'flex h-5 shrink-0 items-center gap-1 self-center rounded-md bg-subtle px-2 text-meta text-muted-foreground',
        'motion-safe:transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
      )}
    >
      <span>{label}</span>
      {attention === null || tone === null ? null : (
        <span className={tintClasses(tone).text}>{`· ${attention}`}</span>
      )}
      <ChevronDown
        size={ICON_SIZE.control}
        aria-hidden
        className={cn('shrink-0 motion-safe:transition-transform', isExpanded && 'rotate-180')}
      />
    </button>
  );
};
