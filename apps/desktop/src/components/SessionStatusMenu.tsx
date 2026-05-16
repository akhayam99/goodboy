import { useEffect, useRef, useState } from 'react';
import { cn } from '@kay-am/ui';
import type { SessionUserStatus } from '@kay-am/types';
import { SESSION_STATUS_ORDER, SESSION_STATUS_PALETTE } from '../session-status';

interface SessionStatusMenuProps {
  readonly status: SessionUserStatus;
  readonly sessionLabel: string;
  readonly onPick: (next: SessionUserStatus) => void;
}

export function SessionStatusMenu({ status, sessionLabel, onPick }: SessionStatusMenuProps) {
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

  const entry = SESSION_STATUS_PALETTE[status];
  const Icon = entry.icon;

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
          'inline-flex h-4 w-4 items-center justify-center rounded transition-colors hover:bg-muted',
          entry.className,
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`change session status (current: ${entry.label})`}
        title={`${sessionLabel} — ${entry.label} (click to change)`}
      >
        <Icon size={12} aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1 flex min-w-[10rem] flex-col rounded-md border border-border bg-subtle p-1 text-foreground shadow-md"
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          {SESSION_STATUS_ORDER.map((option) => {
            const optEntry = SESSION_STATUS_PALETTE[option];
            const OptIcon = optEntry.icon;
            const selected = option === status;
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
                    'inline-flex h-4 w-4 items-center justify-center',
                    optEntry.className,
                  )}
                >
                  <OptIcon size={12} aria-hidden />
                </span>
                <span className="text-foreground">{optEntry.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
