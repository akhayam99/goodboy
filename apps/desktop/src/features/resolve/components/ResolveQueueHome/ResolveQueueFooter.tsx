import type { ReactNode } from 'react';
import { CalendarClock, CheckCheck } from 'lucide-react';
import { CountToggle } from '@goodboy/ui';
import { RESOLVE_HISTORY_LABEL } from '../../resolveQueueCopy';
import type { ResolveQueueRow } from '../../buildResolveQueueRows';

type Props = {
  readonly resolved: ReadonlyArray<ResolveQueueRow>;
  readonly later: ReadonlyArray<ResolveQueueRow>;
  readonly renderRows: (params: {
    readonly rows: ReadonlyArray<ResolveQueueRow>;
    readonly label: string;
  }) => ReactNode;
  readonly isDeferredShown: boolean;
  readonly isResolvedShown: boolean;
  readonly onDeferredShownChange: (isShown: boolean) => void;
  readonly onResolvedShownChange: (isShown: boolean) => void;
};

export const ResolveQueueFooter = ({
  resolved,
  later,
  renderRows,
  isDeferredShown,
  isResolvedShown,
  onDeferredShownChange,
  onResolvedShownChange,
}: Props) => {
  if (resolved.length === 0 && later.length === 0) {
    return null;
  }
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex items-center gap-4">
        {resolved.length > 0 && (
          <CountToggle
            label={RESOLVE_HISTORY_LABEL.resolved}
            count={resolved.length}
            isShown={isResolvedShown}
            icon={CheckCheck}
            onChange={onResolvedShownChange}
          />
        )}
        {later.length > 0 && (
          <CountToggle
            label={RESOLVE_HISTORY_LABEL.later}
            count={later.length}
            isShown={isDeferredShown}
            icon={CalendarClock}
            onChange={onDeferredShownChange}
          />
        )}
      </div>
      {isResolvedShown &&
        resolved.length > 0 &&
        renderRows({ rows: resolved, label: RESOLVE_HISTORY_LABEL.resolved })}
      {isDeferredShown &&
        later.length > 0 &&
        renderRows({ rows: later, label: RESOLVE_HISTORY_LABEL.later })}
    </div>
  );
};
