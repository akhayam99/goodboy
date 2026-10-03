import { cn, tintClasses } from '@goodboy/ui';
import { groupSummaryText, type GroupSummary } from '../../../../timeline/groupSummary';

type Props = {
  readonly summary: GroupSummary;
  readonly className?: string;
};

export const TimelineGroupSummaryLine = ({ summary, className }: Props) => (
  <span
    data-testid="resolve-batch-summary"
    title={groupSummaryText({ summary })}
    className={cn('min-w-0 truncate text-secondary text-muted-foreground', className)}
  >
    {summary.parts.map((part, index) => (
      <span key={part.state}>
        {index === 0 ? null : <span className="whitespace-pre text-faint-foreground">{' · '}</span>}
        <span className={part.isFailure ? tintClasses('danger').text : undefined}>
          {`${part.count} ${part.noun}`}
        </span>
      </span>
    ))}
  </span>
);
