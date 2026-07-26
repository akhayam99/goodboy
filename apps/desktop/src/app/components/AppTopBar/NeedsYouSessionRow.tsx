import { StatusDot } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useSessionStageInfo } from '../../../store';

type Props = {
  readonly session: Session;
  readonly onSelect: (params: SelectParams) => void;
};

type SelectParams = {
  readonly sessionId: SessionId;
};

export const NeedsYouSessionRow = ({ session, onSelect }: Props) => {
  const { reason } = useSessionStageInfo(session);

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect({ sessionId: session.id as SessionId })}
        title={`${session.goal} · ${reason}`}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
      >
        <StatusDot tone="warning" size="sm" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-xs font-medium text-foreground">{session.goal}</span>
          <span className="truncate text-2xs text-muted-foreground">{reason}</span>
        </span>
      </button>
    </li>
  );
};
