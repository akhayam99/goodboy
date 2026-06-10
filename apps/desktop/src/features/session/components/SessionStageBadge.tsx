import { cn } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useSessionStageInfo } from '../../../store';
import { SESSION_STAGE_META } from '../session-stage';

type Props = {
  readonly session: Session;
};

export const SessionStageBadge = ({ session }: Props) => {
  const { stage, reason } = useSessionStageInfo(session);
  const meta = SESSION_STAGE_META[stage];
  return (
    <span
      title={reason}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2 py-0.5"
    >
      <span
        aria-hidden
        className={cn(
          'size-1.5 rounded-full',
          meta.dotClassName,
          stage === 'running' && 'animate-pulse',
        )}
      />
      <span className={cn('whitespace-nowrap text-2xs font-medium', meta.textClassName)}>
        {meta.label}
      </span>
    </span>
  );
};
