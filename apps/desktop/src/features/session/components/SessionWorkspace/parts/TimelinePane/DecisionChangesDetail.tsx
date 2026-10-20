import { Button } from '@goodboy/ui';
import type {
  DecisionChangeDetail,
  DetailHeightParams,
} from '../../../../timeline/decisionChangeLines';
import { useReportedHeight } from '../../../../hooks/useReportedHeight';

type Props = {
  readonly id: string;
  readonly rowId: string;
  readonly detail: DecisionChangeDetail;
  readonly onOpenInContext: () => void;
  readonly onMeasured: (params: DetailHeightParams) => void;
};

export const DecisionChangesDetail = ({
  id,
  rowId,
  detail,
  onOpenInContext,
  onMeasured,
}: Props) => {
  const body = useReportedHeight({ rowId, onMeasured });

  return (
    <div ref={body} id={id} className="flex min-w-0 flex-col gap-1 py-1 pl-2 pr-2">
      {detail.lines.map((line) => (
        <div
          key={line.key}
          className="grid min-w-0 grid-cols-[8px_auto_minmax(0,1fr)] items-baseline gap-x-2 text-label text-muted-foreground"
        >
          <span aria-hidden className="text-center text-faint-foreground">
            {line.sign ?? ''}
          </span>
          <span className="text-meta text-foreground">{line.label}</span>
          <p className="min-w-0 break-words">{line.text}</p>
          {line.note === null ? null : (
            <p className="col-start-3 min-w-0 break-words text-faint-foreground">{line.note}</p>
          )}
        </div>
      ))}
      {detail.hiddenCount > 0 ? (
        <p className="pl-4 text-label text-faint-foreground">{`and ${detail.hiddenCount} more`}</p>
      ) : null}
      <span className="flex items-center">
        <Button variant="ghost" size="xs" onClick={onOpenInContext}>
          Open in Context
        </Button>
      </span>
    </div>
  );
};
