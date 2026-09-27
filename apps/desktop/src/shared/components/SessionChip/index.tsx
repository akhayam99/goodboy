import type { SessionId } from '@goodboy/types';
import { cn } from '@goodboy/ui';
import { useSessionById } from '../../../store';
import { LiveSessionChip } from './LiveSessionChip';

type Props = {
  readonly sessionId: SessionId;
  readonly className?: string;
};

export const SessionChip = ({ sessionId, className }: Props) => {
  const session = useSessionById(sessionId);
  if (session === null) {
    return <span className={cn('text-label text-faint-foreground', className)}>No session</span>;
  }
  return <LiveSessionChip session={session} className={className} />;
};
