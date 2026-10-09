import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { X } from 'lucide-react';
import { cn } from '../cn';
import { useEscapeLayer } from '../useEscapeLayer';
import { lastFocusedElement } from '../useLastFocused';
import { Divider } from './Divider';
import { IconButton } from './IconButton';
import { ScrollFade } from './ScrollFade';

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

const FIELD_SELECTOR = 'textarea, input, [contenteditable="true"]';

const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel', 'number', 'password']);

const focusableTrigger = (): HTMLElement | null => {
  if (typeof document === 'undefined') {
    return null;
  }
  const active = document.activeElement;
  if (active instanceof HTMLElement && active !== document.body) {
    return active;
  }
  return lastFocusedElement();
};

const hasDraft = (element: HTMLElement): boolean => {
  if (element instanceof HTMLTextAreaElement) {
    return element.value !== '';
  }
  if (element instanceof HTMLInputElement) {
    return TEXT_INPUT_TYPES.has(element.type) && element.value !== '';
  }
  if (element.isContentEditable || element.getAttribute('contenteditable') === 'true') {
    return (element.textContent ?? '') !== '';
  }
  return false;
};

export const DrawerFrame = ({
  title,
  icon: Icon,
  iconClassName,
  count,
  action,
  toolbar,
  closeLabel = 'Close',
  onClose,
  dock,
  scroll = 'frame',
  children,
}: DrawerFrameProps) => {
  const [trigger] = useState(focusableTrigger);
  const sectionRef = useRef<HTMLElement | null>(null);
  const dockRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const hasToolbar = toolbar != null;

  useEscapeLayer(() => {
    const active = document.activeElement;
    const section = sectionRef.current;
    if (
      active instanceof HTMLElement &&
      section !== null &&
      section.contains(active) &&
      hasDraft(active)
    ) {
      active.blur();
      return;
    }
    onClose();
  });

  useEffect(() => {
    const section = sectionRef.current;
    if (section !== null && !section.contains(document.activeElement)) {
      const field = dockRef.current?.querySelector<HTMLElement>(FIELD_SELECTOR);
      (field ?? closeRef.current)?.focus({ preventScroll: true });
    }
    return () => {
      if (trigger === null || !trigger.isConnected) {
        return;
      }
      trigger.focus();
    };
  }, [trigger]);

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
        <IconButton ref={closeRef} icon={X} label={closeLabel} variant="ghost" onClick={onClose} />
      </div>
    </>
  );

  return (
    <section
      ref={sectionRef}
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
      {dock != null ? (
        <div ref={dockRef} className="shrink-0 px-4 py-3">
          {dock}
        </div>
      ) : null}
    </section>
  );
};
