import { WORK_ROW, cn } from '@goodboy/ui';
import type { GroupSummary } from '../../../../timeline/groupSummary';
import { TimelineGroupSummaryLine } from './TimelineGroupSummaryLine';

type Props = {
  readonly title: string;
  readonly summary: GroupSummary;
  readonly tag?: string | null;
};

export const TimelineGroupLabel = ({ title, summary, tag = null }: Props) => (
  <>
    <span
      title={title}
      className={cn(
        'flex min-w-0 items-center gap-2 overflow-hidden text-row text-foreground',
        WORK_ROW.title,
      )}
    >
      <span className="min-w-0 overflow-hidden text-ellipsis whitespace-pre">{title}</span>
      {tag === null ? null : (
        <span
          data-testid="resolve-batch-tag"
          className="flex h-5 shrink-0 items-center rounded-md bg-subtle px-2 text-meta text-muted-foreground"
        >
          {tag}
        </span>
      )}
    </span>
    <TimelineGroupSummaryLine summary={summary} />
  </>
);
