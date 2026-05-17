import { useEffect, useRef, useState } from 'react';
import { cn } from '@kay-am/ui';
import {
  AGENT_KIND_ORDER,
  AGENT_KIND_PALETTE,
  type AgentKind,
} from '../../../../features/session/agent-kind';

interface AgentKindMenuProps {
  readonly kind: AgentKind;
  readonly agentLabel: string;
  readonly onPick: (next: AgentKind) => void;
}

export function AgentKindMenu({ kind, agentLabel, onPick }: AgentKindMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onDocClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const palette = AGENT_KIND_PALETTE[kind];

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onDoubleClick={(e) => e.stopPropagation()}
        className={cn(
          'inline-flex w-[3.25rem] items-center justify-center rounded py-0.5 text-[9px] font-semibold uppercase leading-none tracking-wide transition-opacity hover:opacity-80',
          palette.bg,
          'text-zinc-950',
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`change agent kind (current: ${palette.label})`}
        title={`${agentLabel} — ${palette.label} (click to change)`}
      >
        {palette.label}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1 flex min-w-[8rem] flex-col rounded-md border border-border bg-subtle p-1 text-foreground shadow-md"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {AGENT_KIND_ORDER.map((option) => {
            const entry = AGENT_KIND_PALETTE[option];
            const selected = option === kind;
            return (
              <button
                key={option}
                role="menuitem"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  if (!selected) onPick(option);
                }}
                className={cn(
                  'flex items-center gap-2 rounded px-2 py-1 text-left text-xs transition-colors',
                  selected ? 'bg-muted font-medium' : 'hover:bg-muted/60',
                )}
              >
                <span
                  className={cn(
                    'inline-flex w-[3.25rem] items-center justify-center rounded py-0.5 text-[9px] font-semibold uppercase leading-none tracking-wide',
                    entry.bg,
                    'text-zinc-950',
                  )}
                >
                  {entry.label}
                </span>
                <span className="text-muted-foreground">{option}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
