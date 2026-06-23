import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@goodboy/ui';
import type { ClaudePermissionMode, ProviderId, Session } from '@goodboy/types';
import { useAppStore } from '../../../../store';

const MODE_UNENFORCED_PROVIDERS: ReadonlyArray<ProviderId> = ['cursor', 'gemini'];

type ModeMeta = {
  readonly value: ClaudePermissionMode;
  readonly label: string;
  readonly description: string;
  readonly dot: string;
  readonly text: string;
};

const PERMISSION_MODES: ReadonlyArray<ModeMeta> = [
  {
    value: 'bypassPermissions',
    label: 'Bypass',
    description: 'Agent uses all tools freely, no prompts',
    dot: 'bg-danger',
    text: 'text-danger',
  },
  {
    value: 'acceptEdits',
    label: 'Edits',
    description: 'File edits allowed, asks before bash',
    dot: 'bg-warning',
    text: 'text-warning',
  },
  {
    value: 'default',
    label: 'Default',
    description: 'Asks before writes and runs',
    dot: 'bg-info',
    text: 'text-info',
  },
  {
    value: 'plan',
    label: 'Plan',
    description: 'No tool calls executed, read-only',
    dot: 'bg-muted-foreground',
    text: 'text-muted-foreground',
  },
];

export const permissionModeMeta = (mode: ClaudePermissionMode): ModeMeta => {
  return PERMISSION_MODES.find((m) => m.value === mode) ?? PERMISSION_MODES[0]!;
};

type Props = {
  readonly session: Session;
  readonly activeProvider: ProviderId;
};

export const PermissionModePicker = ({ session, activeProvider }: Props) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const setSessionPermissionMode = useAppStore((s) => s.setSessionPermissionMode);
  const current = permissionModeMeta(session.permissionMode);
  const unenforced = MODE_UNENFORCED_PROVIDERS.includes(activeProvider);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('goodboy:open-permission-picker', handler);
    return () => window.removeEventListener('goodboy:open-permission-picker', handler);
  }, []);

  const onPick = (mode: ClaudePermissionMode) => {
    void setSessionPermissionMode(session.id, mode);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={unenforced ? 'Not enforced for cursor and gemini' : current.description}
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
          className="absolute bottom-full left-0 z-30 mb-1.5 w-64 overflow-hidden rounded-lg bg-subtle py-1.5 text-xs shadow-lg ring-1 ring-border-soft"
        >
          <div className="flex items-center justify-between px-2.5 pb-0.5 pt-1">
            <span className="text-2xs uppercase tracking-wide text-muted-foreground/70">
              Permission mode
            </span>
            <span className="rounded-sm bg-warning/15 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-warning">
              Beta
            </span>
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
          {unenforced ? (
            <p className="px-2.5 pb-1 pt-1.5 text-2xs text-muted-foreground/80">
              Not enforced for cursor and gemini.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};
