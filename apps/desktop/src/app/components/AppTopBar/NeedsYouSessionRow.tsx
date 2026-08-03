import { cn, tintClasses } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useSessionStageInfo } from '../../../store';
import { ATTENTION_REASON_META } from '../../../features/session/session-stage';
import { CONCEPT_ICONS } from '../../../shared/components/conceptIcons';

type Props = {
  readonly session: Session;
  readonly onSelect: (params: SelectParams) => void;
};

type SelectParams = {
  readonly sessionId: SessionId;
};

export const NeedsYouSessionRow = ({ session, onSelect }: Props) => {
  const { reason, attention } = useSessionStageInfo(session);
  const meta = attention == null ? null : ATTENTION_REASON_META[attention];
  const Icon = CONCEPT_ICONS[meta?.icon ?? 'sessions'];

  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect({ sessionId: session.id as SessionId })}
        title={`${session.goal} · ${reason}`}
        className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/50"
      >
        <Icon
          size={14}
          aria-hidden
          className={cn('mt-px shrink-0', tintClasses(meta?.tone ?? 'neutral').icon)}
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-xs font-medium text-foreground">{session.goal}</span>
          <span className="truncate text-2xs text-muted-foreground">{reason}</span>
        </span>
      </button>
    </li>
  );
};
