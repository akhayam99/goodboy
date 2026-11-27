import { StatusMark, cn, tintClasses } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useAppStore, useSessionStageInfo } from '../../../../store';
import { sessionTitle } from '../../../../shared/utils/sessionTitle';
import { formatDuration } from '../../../../shared/utils/time/formatDuration';
import { openSessionPlace } from '../../openSessionPlace';
import { WidgetRow } from '../../WidgetCard/WidgetRow';
import { runningSinceOf } from './runningSinceOf';

type Props = {
  readonly session: Session;
  readonly nowMs: number;
  readonly isLong: boolean;
};

export const RunningRow = ({ session, nowMs, isLong }: Props) => {
  const since = useAppStore((state) => runningSinceOf({ state, sessionId: session.id }));
  const info = useSessionStageInfo(session);
  const title = sessionTitle({ session });
  const elapsed = since === null ? null : formatDuration({ durationMs: nowMs - since });
  return (
    <WidgetRow
      lead={<StatusMark mark={{ kind: 'dot', tone: 'info' }} />}
      title={title}
      meta={info.reason}
      label={`Open ${title}, running`}
      onOpen={() => openSessionPlace({ sessionId: session.id })}
      trailing={
        elapsed === null ? undefined : (
          <span
            className={cn(
              'text-meta tabular-nums',
              isLong ? tintClasses('warning').text : 'text-muted-foreground',
            )}
          >
            {elapsed}
          </span>
        )
      }
    />
  );
};
