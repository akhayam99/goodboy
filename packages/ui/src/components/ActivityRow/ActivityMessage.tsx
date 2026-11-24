import type { ReactNode } from 'react';
import { cn } from '../../cn';
import {
  ACTIVITY_MESSAGE_BUBBLE,
  ACTIVITY_ROW_DENSITY,
  ACTIVITY_ROW_ORDINAL,
  type ActivityRowDensity,
  type ActivityRowOrdinalSlot,
} from './activityRowSpec';

type Props = {
  readonly text: string;
  readonly byline: ReactNode;
  readonly density: ActivityRowDensity;
  readonly isPending: boolean;
  readonly marker?: ReactNode;
  readonly actions?: ReactNode;
  readonly alignWith?: ActivityRowOrdinalSlot | null;
  readonly className?: string;
};

export const ActivityMessage = ({
  text,
  byline,
  density,
  isPending,
  marker = null,
  actions = null,
  alignWith = null,
  className,
}: Props) => {
  const layout = ACTIVITY_ROW_DENSITY[density];
  const bubble = (
    <span
      data-testid="activity-message-bubble"
      className={cn(
        'min-w-0 rounded-lg px-2 py-0.5 text-ui',
        isPending ? ACTIVITY_MESSAGE_BUBBLE.pending : ACTIVITY_MESSAGE_BUBBLE.read,
        layout.text,
      )}
    >
      {text}
    </span>
  );
  return (
    <div
      data-testid="activity-message"
      data-message-pending={isPending}
      data-activity-density={density}
      className={cn('relative flex min-w-0 flex-1 gap-2 pl-3 pr-2', layout.row, className)}
    >
      {marker === null ? null : <span className={layout.slot}>{marker}</span>}
      {alignWith === null ? null : (
        <span aria-hidden className={cn('shrink-0', ACTIVITY_ROW_ORDINAL[alignWith])} />
      )}
      {density === 'rail' ? (
        <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
          {bubble}
          <span className="flex items-center gap-2 text-meta text-faint-foreground">
            <span>{byline}</span>
            {actions}
          </span>
        </span>
      ) : (
        <>
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {bubble}
            {actions}
          </span>
          <span className="flex shrink-0 justify-end whitespace-nowrap text-meta text-faint-foreground">
            {byline}
          </span>
        </>
      )}
    </div>
  );
};
