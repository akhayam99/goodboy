import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Popover, cn } from '@goodboy/ui';
import { Plus } from 'lucide-react';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import {
  AGENT_KIND_DEFAULTS,
  AGENT_KIND_META,
  AGENT_KIND_ORDER,
  AGENT_KIND_PALETTE,
} from '../../../../../features/session/agent-kind';

type SpawnAgentControlProps = {
  sessionId: SessionId;
};

type PopoverAnchor = {
  readonly left: number;
  readonly top: number | null;
  readonly bottom: number | null;
  readonly direction: 'up' | 'down';
};

export function SpawnAgentControl({ sessionId }: SpawnAgentControlProps) {
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<PopoverAnchor | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const spawnAgent = useAppStore((s) => s.spawnAgent);

  const computeAnchor = useCallback((): PopoverAnchor | null => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) {
      return null;
    }
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    const direction: 'up' | 'down' = spaceBelow > spaceAbove ? 'down' : 'up';
    const left = rect.right + 4;
    if (direction === 'down') {
      return { left, top: rect.top, bottom: null, direction };
    }
    return { left, top: null, bottom: window.innerHeight - rect.bottom, direction };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) {
        return;
      }
      if (menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const onReanchor = () => {
      const next = computeAnchor();
      if (next) {
        setAnchor(next);
      } else {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onDocClick);
    window.addEventListener('resize', onReanchor);
    window.addEventListener('scroll', onReanchor, true);
    return () => {
      window.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('resize', onReanchor);
      window.removeEventListener('scroll', onReanchor, true);
    };
  }, [open, computeAnchor]);

  const onToggle = () => {
    if (!open) {
      const next = computeAnchor();
      if (next) {
        setAnchor(next);
      }
    }
    setOpen((v) => !v);
  };

  const menu =
    open && anchor
      ? createPortal(
          <Popover
            innerRef={menuRef}
            role="menu"
            style={{
              position: 'fixed',
              left: anchor.left,
              ...(anchor.top !== null ? { top: anchor.top } : {}),
              ...(anchor.bottom !== null ? { bottom: anchor.bottom } : {}),
            }}
            className="z-50 w-80 max-h-72 overflow-y-auto py-1"
          >
            <div className="px-2.5 pb-1 pt-1.5 text-2xs uppercase tracking-wide text-muted-foreground/70">
              by role
            </div>
            {[...AGENT_KIND_ORDER]
              .filter((kind) => AGENT_KIND_DEFAULTS[kind].visible !== false)
              .sort((a, b) => AGENT_KIND_META[a].label.localeCompare(AGENT_KIND_META[b].label))
              .map((kind) => {
                const meta = AGENT_KIND_META[kind];
                const palette = AGENT_KIND_PALETTE[kind];
                return (
                  <button
                    key={kind}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      void spawnAgent(sessionId, { kindOverride: kind });
                      window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
                    }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-muted"
                  >
                    <span className={cn('size-2 shrink-0 rounded-full', palette.bg)} aria-hidden />
                    <span className="font-medium text-foreground">{meta.label}</span>
                    <span className="truncate text-2xs text-muted-foreground">{meta.hint}</span>
                  </button>
                );
              })}
          </Popover>,
          document.body,
        )
      : null;

  return (
    <div className="relative mt-1">
      <button
        ref={triggerRef}
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 rounded border border-dashed border-border-soft px-2 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Plus size={13} aria-hidden />
        Create agent
      </button>
      {menu}
    </div>
  );
}
