import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@kay-am/ui';
import type { ClaudePermissionMode, Task } from '@kay-am/types';
import { useAppStore } from '../../store';

interface ModeMeta {
  readonly value: ClaudePermissionMode;
  readonly label: string;
  readonly description: string;
  readonly dot: string;
  readonly text: string;
}

export const PERMISSION_MODES: ReadonlyArray<ModeMeta> = [
  {
    value: 'bypassPermissions',
    label: 'bypass',
    description: 'bypass — agent uses all tools freely',
    dot: 'bg-red-500',
    text: 'text-red-500',
  },
  {
    value: 'acceptEdits',
    label: 'edits',
    description: 'accept edits — asks before bash',
    dot: 'bg-amber-500',
    text: 'text-amber-500',
  },
  {
    value: 'default',
    label: 'default',
    description: 'default — asks before writes/runs',
    dot: 'bg-blue-500',
    text: 'text-blue-500',
  },
  {
    value: 'plan',
    label: 'plan',
    description: 'plan — no tool calls executed',
    dot: 'bg-slate-400',
    text: 'text-slate-400',
  },
];

export function permissionModeMeta(mode: ClaudePermissionMode): ModeMeta {
  return PERMISSION_MODES.find((m) => m.value === mode) ?? PERMISSION_MODES[0]!;
}

interface PermissionModePickerProps {
  readonly session: Task;
}

export function PermissionModePicker({ session }: PermissionModePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const setSessionPermissionMode = useAppStore((s) => s.setSessionPermissionMode);
  const current = permissionModeMeta(session.permissionMode);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const onPick = (mode: ClaudePermissionMode) => {
    void setSessionPermissionMode(session.id, mode);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={current.description}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-full bg-subtle px-2.5 py-0.5 text-xs transition-colors hover:bg-muted"
      >
        <span aria-hidden className={cn('inline-block h-1.5 w-1.5 rounded-full', current.dot)} />
        <span className={cn('font-medium', current.text)}>{current.label}</span>
        <ChevronDown size={11} aria-hidden className="text-muted-foreground/70" />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label="permission mode"
          className="absolute bottom-full left-0 z-30 mb-1.5 w-64 overflow-hidden rounded-lg bg-background py-1.5 text-xs shadow-lg ring-1 ring-border-soft"
        >
          <div className="px-2.5 pb-0.5 pt-1 text-2xs uppercase tracking-wide text-muted-foreground/70">
            permission mode
          </div>
          {PERMISSION_MODES.map((m) => {
            const active = session.permissionMode === m.value;
            return (
              <button
                key={m.value}
                type="button"
                onClick={() => onPick(m.value)}
                className={cn(
                  'flex w-full items-start gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-muted',
                  active ? '' : 'opacity-80',
                )}
              >
                <span
                  aria-hidden
                  className={cn('mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full', m.dot)}
                />
                <span className="min-w-0 flex-1">
                  <span className={cn('block font-medium', m.text)}>{m.label}</span>
                  <span className="block text-2xs text-muted-foreground">{m.description}</span>
                </span>
                {active ? (
                  <span aria-hidden className="mt-0.5 text-2xs text-primary">
                    ✓
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
