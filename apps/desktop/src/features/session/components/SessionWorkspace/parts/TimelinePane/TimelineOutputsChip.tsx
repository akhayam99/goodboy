import { ChevronDown } from 'lucide-react';
import { cn } from '@goodboy/ui';
import { ICON_SIZE } from '../../../../../../shared/components/conceptIcons';
import type { TimelineRowOutputs } from '../../../../timeline/buildTimelineStream';
import { outputsLabel } from '../../../../timeline/outputsLabel';

type Props = {
  readonly outputs: TimelineRowOutputs;
  readonly isExpanded: boolean;
  readonly onSet: (params: { readonly id: string; readonly isExpanded: boolean }) => void;
};

export const TimelineOutputsChip = ({ outputs, isExpanded, onSet }: Props) => {
  const label = outputsLabel({ count: outputs.count });
  return (
    <button
      type="button"
      data-testid="timeline-outputs-chip"
      aria-expanded={isExpanded}
      aria-label={isExpanded ? `Hide ${label}` : `Show ${label}`}
      onClick={() => onSet({ id: outputs.id, isExpanded: !isExpanded })}
      className={cn(
        'flex h-5 shrink-0 items-center gap-1 self-center rounded-md bg-subtle px-2 text-meta text-muted-foreground',
        'motion-safe:transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
      )}
    >
      <span>{label}</span>
      <ChevronDown
        size={ICON_SIZE.control}
        aria-hidden
        className={cn('shrink-0 motion-safe:transition-transform', isExpanded && 'rotate-180')}
      />
    </button>
  );
};
