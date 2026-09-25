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
  readonly closeLabel?: string;
  readonly onClose: () => void;
  readonly dock?: ReactNode;
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
  closeLabel = 'Close panel',
  onClose,
  dock,
  children,
}: DrawerFrameProps) => {
  const triggerRef = useRef<HTMLElement | null>(focusableTrigger());
  useEscapeLayer(onClose);

  useEffect(() => {
    const trigger = triggerRef.current;
    return () => {
      if (trigger === null || !trigger.isConnected) {
        return;
      }
      trigger.focus();
    };
  }, []);

  return (
    <section
      aria-label={title}
      className="flex h-full min-h-0 min-w-0 flex-col bg-background motion-safe:animate-nav-step-in"
    >
      <header className="flex h-11 shrink-0 items-center gap-2 pl-4 pr-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {Icon == null ? null : (
            <Icon size={14} aria-hidden className={cn('shrink-0', iconClassName)} />
          )}
          <h2 className="min-w-0 truncate text-sm font-semibold text-foreground">{title}</h2>
          {count != null ? (
            <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">{count}</span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
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
      </header>
      <Divider />
      <ScrollFade className="min-h-0 flex-1" viewportClassName="px-4 py-3" fadeSize={24}>
        {children}
      </ScrollFade>
      {dock != null ? <div className="shrink-0 px-4 py-3">{dock}</div> : null}
    </section>
  );
};
