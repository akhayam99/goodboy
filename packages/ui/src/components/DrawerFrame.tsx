import { useEffect, useRef, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { X } from 'lucide-react';
import { cn } from '../cn';
import { useEscapeLayer } from '../useEscapeLayer';
import { Divider } from './Divider';
import { ScrollFade } from './ScrollFade';
import { Tooltip } from './Tooltip';

export type DrawerFrameProps = {
  readonly title: string;
  readonly icon?: LucideIcon;
  readonly iconClassName?: string;
  readonly count?: ReactNode;
  readonly action?: ReactNode;
  readonly toolbar?: ReactNode;
  readonly closeLabel?: string;
  readonly onClose: () => void;
  readonly dock?: ReactNode;
  readonly scroll?: 'frame' | 'self';
  readonly children: ReactNode;
};

const focusableTrigger = (): HTMLElement | null => {
  if (typeof document === 'undefined') {
    return null;
  }
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || active === document.body) {
    return null;
  }
  return active;
};

export const DrawerFrame = ({
  title,
  icon: Icon,
  iconClassName,
  count,
  action,
  toolbar,
  closeLabel = 'Close panel',
  onClose,
  dock,
  scroll = 'frame',
  children,
}: DrawerFrameProps) => {
  const triggerRef = useRef<HTMLElement | null>(focusableTrigger());
  useEscapeLayer(onClose);
  const hasToolbar = toolbar != null;

  useEffect(() => {
    const trigger = triggerRef.current;
    return () => {
      if (trigger === null || !trigger.isConnected) {
        return;
      }
      trigger.focus();
    };
  }, []);

  const titleRow = (
    <>
      <div className={cn('flex min-w-0 flex-1 gap-2', hasToolbar ? 'items-start' : 'items-center')}>
        {Icon == null ? null : (
          <span className="flex h-5 shrink-0 items-center">
            <Icon size={14} aria-hidden className={iconClassName} />
          </span>
        )}
        <h2
          className={cn(
            'min-w-0 text-heading text-foreground',
            hasToolbar ? 'line-clamp-2' : 'truncate',
          )}
        >
          {title}
        </h2>
        {count != null ? (
          <span className="flex h-5 shrink-0 items-center text-meta tabular-nums text-muted-foreground">
            {count}
          </span>
        ) : null}
      </div>
      <div className={cn('flex shrink-0 items-center gap-1', hasToolbar && 'h-5')}>
        {action}
        <Tooltip content={closeLabel}>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="rounded-md p-1 text-faint-foreground transition-colors hover:bg-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <X size={14} aria-hidden />
          </button>
        </Tooltip>
      </div>
    </>
  );

  return (
    <section
      aria-label={title}
      className="flex h-full min-h-0 min-w-0 flex-col bg-subtle motion-safe:animate-nav-step-in"
    >
      <header
        className={
          hasToolbar
            ? 'flex shrink-0 flex-col gap-2 py-2'
            : 'flex h-11 shrink-0 items-center gap-2 pl-4 pr-2'
        }
      >
        {hasToolbar ? (
          <div className="flex min-w-0 items-start gap-2 pl-4 pr-2">{titleRow}</div>
        ) : (
          titleRow
        )}
        {hasToolbar ? (
          <div data-drawer-toolbar="" className="flex min-w-0 flex-col gap-2 px-4">
            {toolbar}
          </div>
        ) : null}
      </header>
      <Divider />
      {scroll === 'self' ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
      ) : (
        <ScrollFade className="min-h-0 flex-1" viewportClassName="px-4 py-3" fadeSize={24}>
          {children}
        </ScrollFade>
      )}
      {dock != null ? <div className="shrink-0 px-4 py-3">{dock}</div> : null}
    </section>
  );
};
