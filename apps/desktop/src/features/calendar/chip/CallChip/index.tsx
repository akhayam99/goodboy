import { Button, cn, FLOATING_SURFACE, ICON_SIZE, IconButton, TruncatedText } from '@goodboy/ui';
import { Calendar, X } from '@goodboy/ui/icons';
import { actionButtonLookOf } from '../../../actions/actionButtonLookOf';
import type { ChipAction, ChipView } from '../callChipTypes';
import { CallChipRows } from './CallChipRows';
import { chipLinesOf } from '../chipLinesOf';

type ActParams = {
  readonly action: ChipAction;
};

type Props = {
  readonly view: ChipView;
  readonly now: number;
  readonly failure: string | null;
  readonly onAct: (params: ActParams) => void;
};

const JOIN = actionButtonLookOf({ verb: 'Join call', variant: 'primary' });
const RETURN = actionButtonLookOf({ verb: 'Return to call', variant: 'secondary' });
const SNOOZE = actionButtonLookOf({ verb: 'Remind me in 5m', variant: 'ghost' });
const JOINS_ON_TOP: ReadonlySet<ChipView['kind']> = new Set(['soon', 'check-link', 'snoozed']);

export const CallChip = ({ view, now, failure, onAct }: Props) => {
  const lines = chipLinesOf({ view, now });
  const isLive = view.kind === 'in-call';
  const join = (
    <Button
      variant={JOIN.variant}
      intent={JOIN.intent}
      size="sm"
      onClick={() => onAct({ action: { kind: 'join' } })}
    >
      Join call
    </Button>
  );

  return (
    <div
      role="status"
      aria-live="polite"
      data-call-chip={view.kind}
      className={cn(FLOATING_SURFACE, 'flex w-full min-w-0 flex-col gap-2 p-3')}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className={cn(
            'inline-flex size-7 shrink-0 items-center justify-center rounded-md bg-selected',
            isLive ? 'text-success' : 'text-info',
          )}
        >
          <Calendar size={ICON_SIZE.control} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <TruncatedText className="text-row text-foreground">{lines.title}</TruncatedText>
          <TruncatedText className="text-meta text-faint-foreground">{lines.sub}</TruncatedText>
        </div>
        {isLive && lines.clock !== null ? (
          <span className="shrink-0 text-heading tabular-nums text-foreground">{lines.clock}</span>
        ) : null}
        {isLive ? (
          <Button
            variant={RETURN.variant}
            intent={RETURN.intent}
            size="sm"
            onClick={() => onAct({ action: { kind: 'return' } })}
          >
            Return to call
          </Button>
        ) : null}
        {JOINS_ON_TOP.has(view.kind) ? join : null}
        <IconButton
          icon={X}
          label="Hide"
          size="sm"
          onClick={() => onAct({ action: { kind: 'hide' } })}
        />
      </div>
      {view.kind === 'countdown' ? (
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              'min-w-0 flex-1 text-heading tabular-nums',
              lines.isStarted ? 'text-success' : 'text-foreground',
            )}
          >
            {lines.clock}
          </span>
          <Button
            variant={SNOOZE.variant}
            intent={SNOOZE.intent}
            size="sm"
            onClick={() => onAct({ action: { kind: 'snooze' } })}
          >
            Remind me in 5m
          </Button>
          {join}
        </div>
      ) : null}
      {view.kind === 'soon' || view.kind === 'after' ? (
        <CallChipRows
          heading={lines.heading}
          rows={view.rows}
          onOpen={({ rowKey }) => onAct({ action: { kind: 'open', rowKey } })}
        />
      ) : null}
      {failure === null ? null : (
        <p role="alert" className="text-meta text-danger">
          {`Goodboy did not answer. ${failure}`}
        </p>
      )}
    </div>
  );
};
