import { Zap, ZapOff } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

interface AutoRunToggleProps {
  readonly session: Session;
}

/**
 * Compact icon toggle for the per-session autorun flag. Only meaningful when
 * the session has a workflow attached — without one the autorun loop has
 * nothing to step through, so the control disables and dims.
 */
export function AutoRunToggle({ session }: AutoRunToggleProps) {
  const setSessionAutoRun = useAppStore((s) => s.setSessionAutoRun);
  const hasWorkflow = !!session.workflowId;
  const tooltip = !hasWorkflow
    ? 'no workflow configured — auto-run unavailable'
    : session.autoRun
      ? 'autorun on — click to pause'
      : 'autorun off — click to enable';
  const ariaLabel = !hasWorkflow
    ? 'autorun unavailable'
    : session.autoRun
      ? 'autorun on'
      : 'autorun off';
  const cls = !hasWorkflow
    ? 'text-muted-foreground/25 cursor-not-allowed'
    : session.autoRun
      ? 'text-amber-500 hover:bg-amber-500/10'
      : 'text-muted-foreground/60 hover:bg-foreground/10 hover:text-foreground';

  return (
    <button
      type="button"
      disabled={!hasWorkflow}
      onClick={() => {
        if (!hasWorkflow) return;
        void setSessionAutoRun(session.id as SessionId, !session.autoRun);
      }}
      title={tooltip}
      aria-label={ariaLabel}
      aria-pressed={hasWorkflow && session.autoRun}
      className={cn('shrink-0 rounded p-1 transition-colors', cls)}
    >
      {hasWorkflow && session.autoRun ? (
        <Zap size={13} aria-hidden />
      ) : (
        <ZapOff size={13} aria-hidden />
      )}
    </button>
  );
}
