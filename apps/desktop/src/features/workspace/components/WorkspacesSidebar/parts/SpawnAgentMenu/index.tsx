import { type ReactNode, type Ref, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Popover, cn } from '@goodboy/ui';
import type { SessionId } from '@goodboy/types';
import { useAppStore } from '../../../../../store';
import {
  AGENT_KIND_DEFAULTS,
  AGENT_KIND_META,
  AGENT_KIND_ORDER,
  AGENT_KIND_PALETTE,
} from '../../../../../features/session/agent-kind';

type SpawnAgentMenuProps = {
  readonly sessionId: SessionId;
  readonly trigger: (props: {
    readonly ref: Ref<HTMLButtonElement>;
    readonly onClick: () => void;
    readonly 'aria-haspopup': 'menu';
    readonly 'aria-expanded': boolean;
  }) => ReactNode;
  readonly onSpawned?: () => void;
};

const MENU_WIDTH = 320;
const MENU_MAX_HEIGHT = 288;
const MENU_MARGIN = 8;

type PopoverAnchor = {
  readonly left: number;
  readonly top: number | null;
  readonly bottom: number | null;
  readonly direction: 'up' | 'down';
};

export function SpawnAgentMenu({ sessionId, trigger, onSpawned }: SpawnAgentMenuProps) {
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
    const direction: 'up' | 'down' =
      spaceBelow > MENU_MAX_HEIGHT || spaceBelow > spaceAbove ? 'down' : 'up';
    const left = Math.max(
      MENU_MARGIN,
      Math.min(rect.left, window.innerWidth - MENU_WIDTH - MENU_MARGIN),
    );
    if (direction === 'down') {
      return { left, top: rect.bottom + 4, bottom: null, direction };
    }
    return { left, top: null, bottom: window.innerHeight - rect.top + 4, direction };
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
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', onDocClick);
    window.addEventListener('resize', onReanchor);
    window.addEventListener('scroll', onReanchor, true);
    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('mousedown', onDocClick);
      window.removeEventListener('resize', onReanchor);
      window.removeEventListener('scroll', onReanchor, true);
      window.removeEventListener('keydown', onEscape);
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
              width: MENU_WIDTH,
              ...(anchor.top !== null ? { top: anchor.top } : {}),
              ...(anchor.bottom !== null ? { bottom: anchor.bottom } : {}),
            }}
            className="z-50 max-h-72 overflow-y-auto py-1"
          >
            <div className="px-3 pb-1 pt-1.5 text-2xs font-medium uppercase tracking-wide text-muted-foreground/70">
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
                      if (onSpawned) {
                        onSpawned();
                      } else {
                        window.dispatchEvent(new CustomEvent('goodboy:reveal-chat'));
                      }
                    }}
                    className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted"
                  >
                    <span
                      className={cn('mt-1 size-2 shrink-0 rounded-full', palette.bg)}
                      aria-hidden
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-xs font-medium text-foreground">{meta.label}</span>
                      <span className="text-2xs leading-snug text-muted-foreground">
                        {meta.hint}
                      </span>
                    </span>
                  </button>
                );
              })}
          </Popover>,
          document.body,
        )
      : null;

  return (
    <>
      {trigger({
        ref: triggerRef,
        onClick: onToggle,
        'aria-haspopup': 'menu',
        'aria-expanded': open,
      })}
      {menu}
    </>
  );
}
