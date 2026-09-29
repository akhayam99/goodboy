import { WORK_ROW, cn, tintClasses } from '@goodboy/ui';
import type { TimelineResolveBatchEntry } from '../../../../timeline/buildTimelineGroups';
import { resolveBatchTitle } from '../../../../timeline/resolveBatchSummary';

type Props = {
  readonly entry: TimelineResolveBatchEntry;
};

export const TimelineResolveBatchLabel = ({ entry }: Props) => {
  const title = resolveBatchTitle({ total: entry.summary.total, prNumber: entry.prNumber });
  return (
    <>
      <span
        title={title}
        className={cn(
          'flex min-w-0 items-center overflow-hidden text-row text-foreground',
          WORK_ROW.title,
        )}
      >
        <span className="min-w-0 overflow-hidden text-ellipsis whitespace-pre">{title}</span>
      </span>
      <span
        data-testid="resolve-batch-summary"
        className="min-w-0 truncate text-secondary text-muted-foreground"
      >
        {entry.summary.parts.map((part, index) => (
          <span key={part.state}>
            {index === 0 ? null : (
              <span className="whitespace-pre text-faint-foreground">{' · '}</span>
            )}
            <span className={part.isFailure ? tintClasses('danger').text : undefined}>
              {`${part.count} ${part.noun}`}
            </span>
          </span>
        ))}
      </span>
    </>
  );
};
