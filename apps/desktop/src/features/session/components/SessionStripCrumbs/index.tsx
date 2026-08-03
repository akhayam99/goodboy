import { ChevronRight } from 'lucide-react';
import { StatusDot, Tooltip, cn } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore, useCurrentSession, useSessionStageInfo } from '../../../../store';
import { STAGE_TONE } from '../../session-stage';
import { useSessionCrumbs } from '../../hooks/useSessionCrumbs';

type CrumbsProps = {
  readonly session: Session;
};

const SessionCrumbs = ({ session }: CrumbsProps) => {
  const crumbs = useSessionCrumbs({ session });
  const stage = useSessionStageInfo(session);
  const setActiveLens = useAppStore((s) => s.setActiveLens);
  const trail = crumbs.slice(1);

  return (
    <div className="flex min-w-0 items-center gap-1.5" data-tauri-drag-region="false">
      <StatusDot tone={STAGE_TONE[stage.stage]} size="sm" title={stage.reason} />
      <Tooltip content={session.goal} side="bottom">
        <button
          type="button"
          onClick={() => setActiveLens(session.id as SessionId, null)}
          className="min-w-16 max-w-80 shrink truncate rounded px-1 py-0.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted/50"
        >
          {session.goal}
        </button>
      </Tooltip>
      {trail.map((crumb) => (
        <span key={crumb.id} className="flex min-w-0 items-center gap-1.5">
          <ChevronRight size={12} aria-hidden className="shrink-0 text-muted-foreground/40" />
          <button
            type="button"
            onClick={crumb.onClick}
            disabled={crumb.onClick == null}
            className={cn(
              'max-w-48 truncate rounded px-1 py-0.5 text-xs transition-colors',
              crumb.onClick == null
                ? 'text-muted-foreground'
                : 'text-muted-foreground/70 hover:bg-muted/50 hover:text-foreground',
            )}
          >
            {crumb.label}
          </button>
        </span>
      ))}
    </div>
  );
};

export const SessionStripCrumbs = () => {
  const currentSession = useCurrentSession();

  if (!currentSession) {
    return null;
  }
  return <SessionCrumbs key={currentSession.id} session={currentSession} />;
};
