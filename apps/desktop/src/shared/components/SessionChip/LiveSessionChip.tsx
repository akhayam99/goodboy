import type { Session, SessionId } from '@goodboy/types';
import { cn, tintClasses } from '@goodboy/ui';
import { sessionPlace, useAppStore, useSessionStageInfo } from '../../../store';
import { SESSION_STAGE_META, STAGE_TONE } from '../../../features/session/session-stage';
import { sessionTitle } from '../../../features/session/sessionTitle';

type Props = {
  readonly session: Session;
  readonly className?: string;
};

export const LiveSessionChip = ({ session, className }: Props) => {
  const navigate = useAppStore((state) => state.navigate);
  const { stage } = useSessionStageInfo(session);
  const title = sessionTitle({ session });
  return (
    <button
      type="button"
      onClick={() => navigate({ to: sessionPlace({ sessionId: session.id as SessionId }) })}
      className={cn(
        'flex min-w-0 items-center gap-1.5 rounded-sm text-left text-label text-foreground hover:underline',
        className,
      )}
    >
      <span
        aria-hidden
        className={cn('size-1.5 shrink-0 rounded-full', tintClasses(STAGE_TONE[stage]).dot)}
      />
      <span className="truncate">{title}</span>
      <span className="shrink-0 text-muted-foreground">· {SESSION_STAGE_META[stage].label}</span>
    </button>
  );
};
