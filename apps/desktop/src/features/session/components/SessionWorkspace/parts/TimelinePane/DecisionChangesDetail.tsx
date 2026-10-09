import { Button } from '@goodboy/ui';
import {
  DECISION_DETAIL_ACTION_HEIGHT,
  DECISION_DETAIL_LINE_HEIGHT,
  type DecisionChangeDetail,
} from '../../../../timeline/decisionChangeLines';

type Props = {
  readonly id: string;
  readonly detail: DecisionChangeDetail;
  readonly onOpenInContext: () => void;
};

export const DecisionChangesDetail = ({ id, detail, onOpenInContext }: Props) => (
  <div id={id} className="flex min-w-0 flex-col py-1 pl-2 pr-2" style={{ height: detail.height }}>
    {detail.lines.map((line) => (
      <p
        key={line.key}
        className="flex min-w-0 items-center gap-2 text-label text-muted-foreground"
        style={{ height: DECISION_DETAIL_LINE_HEIGHT }}
      >
        <span aria-hidden className="w-2 shrink-0 text-center text-faint-foreground">
          {line.sign ?? ''}
        </span>
        <span className="shrink-0 text-meta text-foreground">{line.label}</span>
        <span className="min-w-0 truncate">{line.text}</span>
        {line.note === null ? null : (
          <span className="min-w-0 shrink truncate text-faint-foreground">{`· ${line.note}`}</span>
        )}
      </p>
    ))}
    {detail.hiddenCount > 0 ? (
      <p
        className="flex items-center pl-4 text-label text-faint-foreground"
        style={{ height: DECISION_DETAIL_LINE_HEIGHT }}
      >
        {`and ${detail.hiddenCount} more`}
      </p>
    ) : null}
    <span className="flex items-center" style={{ height: DECISION_DETAIL_ACTION_HEIGHT }}>
      <Button variant="ghost" size="xs" onClick={onOpenInContext}>
        Open in Context
      </Button>
    </span>
  </div>
);
