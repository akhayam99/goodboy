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
    ? 'border-transparent text-muted-foreground/25 cursor-not-allowed'
    : session.autoRun
      ? 'border-danger/40 bg-danger/10 text-danger hover:bg-danger/15'
      : 'border-border-soft text-muted-foreground/70 hover:border-border hover:bg-foreground/5 hover:text-foreground';

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
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide transition-colors',
        cls,
      )}
    >
      <span>auto</span>
      {hasWorkflow && session.autoRun ? (
        <Zap size={11} aria-hidden />
      ) : (
        <ZapOff size={11} aria-hidden />
      )}
    </button>
  );
}
