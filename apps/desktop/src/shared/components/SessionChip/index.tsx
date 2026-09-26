import type { Session, SessionId } from '@goodboy/types';
import { cn, tintClasses } from '@goodboy/ui';
import { sessionPlace, useAppStore, useSessionById, useSessionStageInfo } from '../../../store';
import { SESSION_STAGE_META, STAGE_TONE } from '../../../features/session/session-stage';
import { sessionTitle } from '../../../features/session/sessionTitle';

type Props = {
  readonly sessionId: SessionId;
  readonly className?: string;
};

const LiveSessionChip = ({
  session,
  className,
}: { readonly session: Session } & Pick<Props, 'className'>) => {
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

export const SessionChip = ({ sessionId, className }: Props) => {
  const session = useSessionById(sessionId);
  if (session === null) {
    return <span className={cn('text-label text-faint-foreground', className)}>No session</span>;
  }
  return <LiveSessionChip session={session} className={className} />;
};
