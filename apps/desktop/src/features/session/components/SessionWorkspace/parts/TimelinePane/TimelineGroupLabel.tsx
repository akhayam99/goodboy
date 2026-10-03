import { WORK_ROW, cn } from '@goodboy/ui';
import type { GroupSummary } from '../../../../timeline/groupSummary';
import { TimelineGroupSummaryLine } from './TimelineGroupSummaryLine';

type Props = {
  readonly title: string;
  readonly summary: GroupSummary;
};

export const TimelineGroupLabel = ({ title, summary }: Props) => (
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
    <TimelineGroupSummaryLine summary={summary} />
  </>
);
