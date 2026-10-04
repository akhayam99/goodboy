import type { Session, SessionId } from '@goodboy/types';
import { cn, tintClasses } from '@goodboy/ui';
import { sessionPlace, useAppStore, useSessionStageInfo } from '../../../../store';
import { SESSION_STAGE_META, STAGE_TONE } from '../../../session/session-stage';
import { sessionTitle } from '../../../session/sessionTitle';

type Props = {
  readonly session: Session;
};

export const LiveSessionCells = ({ session }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  const { stage } = useSessionStageInfo(session);
  const title = sessionTitle({ session });
  return (
    <>
      <span data-cell="session" className="flex min-w-0">
        <button
          type="button"
          title={title}
          onClick={() => navigate({ to: sessionPlace({ sessionId: session.id as SessionId }) })}
          className="flex min-w-0 items-center gap-2 rounded-sm text-left text-label text-foreground hover:underline"
        >
          <span
            aria-hidden
            className={cn('size-1.5 shrink-0 rounded-full', tintClasses(STAGE_TONE[stage]).dot)}
          />
          <span className="truncate">{title}</span>
        </button>
      </span>
      <span data-cell="state" className="truncate text-label text-muted-foreground">
        {SESSION_STAGE_META[stage].label}
      </span>
    </>
  );
};
