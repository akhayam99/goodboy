import { StatusMark } from '@goodboy/ui';
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
};

export const RunningRow = ({ session, nowMs }: Props) => {
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
          <span className="text-meta text-muted-foreground tabular-nums">{elapsed}</span>
        )
      }
    />
  );
};
