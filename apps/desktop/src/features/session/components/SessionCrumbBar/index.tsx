import { ChevronRight } from 'lucide-react';
import { StatusDot, cn } from '@goodboy/ui';
import type { Session } from '@goodboy/types';
import { useCurrentSession, useSessionStageInfo } from '../../../../store';
import { STAGE_TONE } from '../../session-stage';
import { useSessionCrumbs } from '../../hooks/useSessionCrumbs';

type CrumbsProps = {
  readonly session: Session;
};

const SessionCrumbs = ({ session }: CrumbsProps) => {
  const crumbs = useSessionCrumbs({ session });
  const stage = useSessionStageInfo(session);

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex h-8 min-w-0 shrink-0 items-center gap-1.5 border-b border-border-soft bg-background px-4"
    >
      <StatusDot tone={STAGE_TONE[stage.stage]} size="sm" title={stage.reason} />
      {crumbs.map((crumb, index) => (
        <span key={crumb.id} className="flex min-w-0 items-center gap-1.5">
          {index > 0 ? (
            <ChevronRight size={12} aria-hidden className="shrink-0 text-muted-foreground/40" />
          ) : null}
          <button
            type="button"
            onClick={crumb.onClick}
            disabled={crumb.onClick == null}
            className={cn(
              'max-w-48 truncate rounded px-1 py-0.5 text-xs transition-colors',
              crumb.onClick == null
                ? 'font-medium text-foreground'
                : 'text-muted-foreground/70 hover:bg-muted/50 hover:text-foreground',
            )}
          >
            {crumb.label}
          </button>
        </span>
      ))}
    </nav>
  );
};

export const SessionCrumbBar = () => {
  const currentSession = useCurrentSession();

  if (!currentSession) {
    return null;
  }
  return <SessionCrumbs key={currentSession.id} session={currentSession} />;
};
