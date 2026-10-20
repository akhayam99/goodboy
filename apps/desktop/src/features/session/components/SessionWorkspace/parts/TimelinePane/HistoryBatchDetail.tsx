import { ValueToken } from '@goodboy/ui';
import type { DetailHeightParams } from '../../../../timeline/decisionChangeLines';
import type { HistoryBatchDetail as Detail } from '../../../../timeline/historyBatchDetail';
import { sessionEventLabel } from '../../../../timeline/sessionEventPresentation';
import { useReportedHeight } from '../../../../hooks/useReportedHeight';

type Props = {
  readonly id: string;
  readonly rowId: string;
  readonly detail: Detail;
  readonly onMeasured: (params: DetailHeightParams) => void;
};

export const HistoryBatchDetail = ({ id, rowId, detail, onMeasured }: Props) => {
  const body = useReportedHeight({ rowId, onMeasured });

  return (
    <div ref={body} id={id} className="flex min-w-0 flex-col gap-1 py-1 pl-2 pr-2">
      <ol aria-label="Events of this batch" className="flex min-w-0 list-none flex-col gap-1">
        {detail.events.map((event) => (
          <li
            key={event.id}
            className="flex min-w-0 items-baseline overflow-hidden text-label text-muted-foreground"
          >
            {sessionEventLabel({ event }).map((segment, index) =>
              segment.kind === 'value' ? (
                <ValueToken key={`${segment.variant}:${index}`} value={segment.text} />
              ) : (
                <span
                  key={`text:${index}`}
                  className="min-w-0 overflow-hidden text-ellipsis whitespace-pre"
                >
                  {segment.text}
                </span>
              ),
            )}
          </li>
        ))}
      </ol>
    </div>
  );
};
