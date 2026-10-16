import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, X } from 'lucide-react';
import { cn } from '../cn';
import { useEscapeLayer } from '../useEscapeLayer';
import { lastFocusedElement } from '../useLastFocused';
import { Button } from './Button';
import { Divider } from './Divider';
import { IconButton } from './IconButton';
import { ScrollFade } from './ScrollFade';
import { FRAME_DRAWER_INSET_PX, FRAME_DRAWER_ROW_PX } from '../frameGeometry';
import { ICON_SIZE } from '../iconSize';

export type DrawerBack = {
  readonly label: string;
  readonly onBack: () => void;
};

export type DrawerFrameProps = {
  readonly title: string;
  readonly icon?: LucideIcon;
  readonly iconClassName?: string;
  readonly count?: ReactNode;
  readonly action?: ReactNode;
  readonly toolbar?: ReactNode;
  readonly back?: DrawerBack;
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
  back,
  closeLabel = 'Close',
  onClose,
  dock,
  scroll = 'frame',
  children,
}: DrawerFrameProps) => {
  const [trigger] = useState(focusableTrigger);
  const sectionRef = useRef<HTMLElement | null>(null);
  const dockRef = useRef<HTMLDivElement | null>(null);
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
      (field ?? section).focus({ preventScroll: true });
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
            <Icon size={ICON_SIZE.control} aria-hidden className={iconClassName} />
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
          <span className="flex h-5 min-w-0 shrink-[4] items-center text-meta tabular-nums text-muted-foreground">
            {count}
          </span>
        ) : null}
      </div>
      <div className={cn('flex shrink-0 items-center gap-1', hasToolbar && 'h-5')}>
        {action}
        <IconButton icon={X} label={closeLabel} variant="ghost" onClick={onClose} />
      </div>
    </>
  );

  return (
    <section
      ref={sectionRef}
      aria-label={title}
      tabIndex={-1}
      className="flex h-full min-h-0 min-w-0 flex-col bg-subtle outline-none motion-safe:animate-nav-step-in"
    >
      <header
        data-drawer-header=""
        style={{ paddingTop: FRAME_DRAWER_INSET_PX, paddingBottom: FRAME_DRAWER_INSET_PX }}
        className={hasToolbar ? 'flex shrink-0 flex-col gap-2' : 'flex shrink-0 flex-col'}
      >
        <div
          data-drawer-header-row=""
          style={{ minHeight: FRAME_DRAWER_ROW_PX }}
          className={cn(
            'flex min-w-0 gap-2 pl-4 pr-2',
            hasToolbar ? 'items-start' : 'items-center',
          )}
        >
          {titleRow}
        </div>
        {hasToolbar ? (
          <div data-drawer-toolbar="" className="flex min-w-0 flex-col gap-2 px-4">
            {toolbar}
          </div>
        ) : null}
      </header>
      <Divider />
      {back === undefined ? null : (
        <div data-drawer-back="" className="flex shrink-0 px-2 pt-2">
          <Button variant="quiet" size="xs" onClick={back.onBack}>
            <ArrowLeft size={ICON_SIZE.row} aria-hidden />
            {back.label}
          </Button>
        </div>
      )}
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
