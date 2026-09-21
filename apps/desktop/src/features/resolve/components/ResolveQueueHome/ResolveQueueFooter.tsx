import type { ReactNode } from 'react';
import { CalendarClock, CheckCheck } from 'lucide-react';
import { CountToggle } from '@goodboy/ui';
import { RESOLVE_HISTORY_LABEL } from '../../resolveQueueCopy';
import type { ResolveQueueRow } from '../../buildResolveQueueRows';

type Props = {
  readonly completed: ReadonlyArray<ResolveQueueRow>;
  readonly later: ReadonlyArray<ResolveQueueRow>;
  readonly renderRow: (params: { readonly row: ResolveQueueRow }) => ReactNode;
  readonly isDeferredShown: boolean;
  readonly isCompletedShown: boolean;
  readonly onDeferredShownChange: (isShown: boolean) => void;
  readonly onCompletedShownChange: (isShown: boolean) => void;
};

export const ResolveQueueFooter = ({
  completed,
  later,
  renderRow,
  isDeferredShown,
  isCompletedShown,
  onDeferredShownChange,
  onCompletedShownChange,
}: Props) => {
  if (completed.length === 0 && later.length === 0) {
    return null;
  }
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex items-center gap-4">
        <CountToggle
          label={RESOLVE_HISTORY_LABEL.later}
          count={later.length}
          isShown={isDeferredShown}
          icon={CalendarClock}
          onChange={onDeferredShownChange}
        />
        <CountToggle
          label={RESOLVE_HISTORY_LABEL.completed}
          count={completed.length}
          isShown={isCompletedShown}
          icon={CheckCheck}
          onChange={onCompletedShownChange}
        />
      </div>
      {isDeferredShown && later.length > 0 && (
        <ol aria-label={RESOLVE_HISTORY_LABEL.later} className="flex flex-col gap-2">
          {later.map((row) => renderRow({ row }))}
        </ol>
      )}
      {isCompletedShown && completed.length > 0 && (
        <ol aria-label={RESOLVE_HISTORY_LABEL.completed} className="flex flex-col gap-2">
          {completed.map((row) => renderRow({ row }))}
        </ol>
      )}
    </div>
  );
};
