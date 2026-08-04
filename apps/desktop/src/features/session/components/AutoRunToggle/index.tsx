import { Zap, ZapOff } from 'lucide-react';
import { Tooltip, cn } from '@goodboy/ui';
import type { Session, SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../store';

type Props = {
  readonly session: Session;
};

export const AutoRunToggle = ({ session }: Props) => {
  const setSessionAutoRun = useAppStore((s) => s.setSessionAutoRun);
  const hasWorkflow = session.workflowRuns.length > 0;
  const anyRunAuto = session.workflowRuns.some((r) => r.autoRun && !r.discardedAt);
  const tooltip = !hasWorkflow
    ? 'No workflow configured, auto-run unavailable'
    : anyRunAuto
      ? 'Autorun on, click to pause'
      : 'Autorun off, click to enable';
  const ariaLabel = !hasWorkflow
    ? 'Autorun unavailable'
    : anyRunAuto
      ? 'Autorun on'
      : 'Autorun off';
  const on = hasWorkflow && anyRunAuto;
  const cls = !hasWorkflow
    ? 'text-muted-foreground/25 cursor-not-allowed'
    : on
      ? 'bg-danger/10 text-danger hover:bg-danger/15'
      : 'text-muted-foreground/60 hover:bg-foreground/10 hover:text-foreground';

  return (
    <Tooltip content={tooltip}>
      <span className="inline-flex shrink-0">
        <button
          type="button"
          disabled={!hasWorkflow}
          onClick={() => {
            if (!hasWorkflow) {
              return;
            }
            void setSessionAutoRun(session.id as SessionId, !on);
          }}
          aria-label={ariaLabel}
          aria-pressed={on}
          className={cn(
            'inline-flex h-6 shrink-0 items-center justify-end rounded-md px-1 transition-colors',
            cls,
          )}
        >
          <span
            aria-hidden
            className={cn(
              'overflow-hidden whitespace-nowrap text-3xs font-semibold tracking-wide',
              'transition-[max-width,opacity,margin] duration-200 ease-out',
              on ? 'mr-1 max-w-[2.5rem] opacity-100' : 'mr-0 max-w-0 opacity-0',
            )}
          >
            auto
          </span>
          {on ? <Zap size={13} aria-hidden /> : <ZapOff size={13} aria-hidden />}
        </button>
      </span>
    </Tooltip>
  );
};
