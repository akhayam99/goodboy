import { Zap, ZapOff } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

interface AutoRunToggleProps {
  readonly session: Session;
}

/**
 * Compact icon toggle for the per-session autorun flag. Only meaningful when
 * the session has a workflow attached, without one the autorun loop has
 * nothing to step through, so the control disables and dims.
 */
export function AutoRunToggle({ session }: AutoRunToggleProps) {
  const setSessionAutoRun = useAppStore((s) => s.setSessionAutoRun);
  const hasWorkflow = session.workflowIds.length > 0;
  const tooltip = !hasWorkflow
    ? 'no workflow configured, auto-run unavailable'
    : session.autoRun
      ? 'autorun on, click to pause'
      : 'autorun off, click to enable';
  const ariaLabel = !hasWorkflow
    ? 'autorun unavailable'
    : session.autoRun
      ? 'autorun on'
      : 'autorun off';
  const on = hasWorkflow && session.autoRun;
  const cls = !hasWorkflow
    ? 'text-muted-foreground/25 cursor-not-allowed'
    : on
      ? 'bg-danger/10 text-danger hover:bg-danger/15'
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
      aria-pressed={on}
      className={cn(
        // Fixed height so the row never reflows vertically when the label
        // appears. Width grows leftward into the row as 'auto' fades in.
        'inline-flex h-6 shrink-0 items-center justify-end rounded-md px-1 transition-colors',
        cls,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'overflow-hidden whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide',
          'transition-[max-width,opacity,margin] duration-200 ease-out',
          on ? 'mr-1 max-w-[2.5rem] opacity-100' : 'mr-0 max-w-0 opacity-0',
        )}
      >
        auto
      </span>
      {on ? <Zap size={13} aria-hidden /> : <ZapOff size={13} aria-hidden />}
    </button>
  );
}
