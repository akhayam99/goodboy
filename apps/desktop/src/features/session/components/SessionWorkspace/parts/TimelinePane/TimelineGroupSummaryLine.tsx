import { tintClasses } from '@goodboy/ui';
import {
  groupSummaryPartText,
  groupSummaryText,
  type GroupSummary,
} from '../../../../timeline/groupSummary';

type Props = {
  readonly summary: GroupSummary;
};

export const TimelineGroupSummaryLine = ({ summary }: Props) => (
  <span
    data-testid="resolve-batch-summary"
    title={groupSummaryText({ summary })}
    className="min-w-0 truncate text-secondary text-muted-foreground"
  >
    {summary.parts.map((part, index) => (
      <span key={part.state}>
        {index === 0 ? null : <span className="whitespace-pre text-faint-foreground">{' · '}</span>}
        <span className={part.isFailure ? tintClasses('danger').text : undefined}>
          {groupSummaryPartText({ part })}
        </span>
      </span>
    ))}
  </span>
);
