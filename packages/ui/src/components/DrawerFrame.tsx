import { DrawerContentContext } from '../drawerContentContext';
import { DrawerBackChipContext } from '../drawerBackChipContext';
import { useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight, X } from 'lucide-react';
import { cn } from '../cn';
import { useEscapeLayer } from '../useEscapeLayer';
import { lastFocusedElement } from '../useLastFocused';
import { DrawerBackLink } from './DrawerBackLink';
import { DrawerHeaderMore } from './DrawerHeaderMore';
import { IconButton } from './IconButton';
import { ScrollFade } from './ScrollFade';
import { RevealRegion } from './RevealRegion';
import { HeaderRevealContext } from '../useHeaderReveal/headerRevealContext';
import { PANE_RHYTHM } from '../paneRhythm';
import { ICON_SIZE } from '../iconSize';

export type DrawerBack = {
  readonly label: string;
  readonly onBack: () => void;
};

export type DrawerPage = {
  readonly tooltip?: string;
  readonly onOpen: () => void;
};

export type DrawerFrameProps = {
  readonly title: string;
  readonly titleContent?: ReactNode;
  readonly icon?: LucideIcon;
  readonly iconClassName?: string;
  readonly count?: ReactNode;
  readonly meta?: ReactNode;
  readonly action?: ReactNode;
  readonly menu?: ReactNode;
  readonly page?: DrawerPage;
  readonly toolbar?: ReactNode;
  readonly back?: DrawerBack;
  readonly closeLabel?: string;
  readonly onClose: () => void;
  readonly dock?: ReactNode;
  readonly scroll?: 'frame' | 'self';
  readonly isHeaderless?: boolean;
  readonly children: ReactNode;
};

const HEADER_INSET_PX = 16;

const META_INSET_WITH_ICON_PX = HEADER_INSET_PX + ICON_SIZE.control + 8;

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
  titleContent,
  icon: Icon,
  iconClassName,
  count,
  meta,
  action,
  menu,
  page,
  toolbar,
  back,
  closeLabel = 'Close',
  onClose,
  dock,
  scroll = 'frame',
  isHeaderless = false,
  children,
}: DrawerFrameProps) => {
  const [trigger] = useState(focusableTrigger);
  const sectionRef = useRef<HTMLElement | null>(null);
  const dockRef = useRef<HTMLDivElement | null>(null);
  const hasToolbar = toolbar != null;
  const drawerContent = useContext(DrawerContentContext);
  const backChip = useContext(DrawerBackChipContext);
  const hasBackChip = backChip != null && !isHeaderless;

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
      {hasBackChip ? backChip : null}
      <div className={cn('flex min-w-0 flex-1 gap-2', hasToolbar ? 'items-start' : 'items-center')}>
        {Icon == null ? null : (
          <span className="flex h-5 shrink-0 items-center">
            <Icon
              size={ICON_SIZE.control}
              aria-hidden
              className={cn('text-muted-foreground', iconClassName)}
            />
          </span>
        )}
        {titleContent != null ? (
          <div className="flex h-5 min-w-24 items-center text-heading text-foreground">
            {titleContent}
          </div>
        ) : (
          <h2
            className={cn(
              'min-w-24 text-heading text-foreground',
              hasToolbar ? 'line-clamp-2' : 'truncate',
            )}
          >
            {title}
          </h2>
        )}
        {count != null ? (
          <span className="flex h-5 min-w-0 shrink-[4] items-center text-meta tabular-nums text-muted-foreground">
            {count}
          </span>
        ) : null}
      </div>
      <div className={cn('flex shrink-0 items-center gap-1', hasToolbar && 'h-5')}>
        {action}
        {menu}
        {page === undefined ? null : (
          <IconButton
            icon={ArrowUpRight}
            label="Open page"
            tooltip={page.tooltip ?? 'Open page'}
            variant="ghost"
            iconSize={ICON_SIZE.control}
            onClick={page.onOpen}
          />
        )}
        <IconButton icon={X} label={closeLabel} variant="ghost" onClick={onClose} />
      </div>
    </>
  );

  const isOverlay = drawerContent?.mode === 'overlay';
  const hasStepAside = !isHeaderless && (isOverlay || meta != null || hasToolbar);
  const backLink =
    back === undefined || isHeaderless || hasBackChip ? null : <DrawerBackLink back={back} />;
  const content = (
    <DrawerBackChipContext.Provider value={null}>{children}</DrawerBackChipContext.Provider>
  );
  const body =
    scroll === 'self' || isHeaderless ? (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{content}</div>
    ) : (
      <ScrollFade className="min-h-0 flex-1" viewportClassName="px-4 py-3" fadeSize={24}>
        {content}
      </ScrollFade>
    );

  return (
    <section
      ref={sectionRef}
      aria-label={title}
      tabIndex={-1}
      className="flex h-full min-h-0 min-w-0 flex-col bg-subtle outline-none motion-safe:animate-nav-step-in"
    >
      {isHeaderless ? null : (
        <header
          data-drawer-header=""
          className={cn('flex shrink-0 flex-col', PANE_RHYTHM.headerInset, !hasStepAside && 'pb-2')}
        >
          <div
            data-drawer-header-row=""
            className={cn(
              'flex min-w-0 gap-2 pl-4 pr-2',
              hasToolbar ? 'min-h-8' : PANE_RHYTHM.headerRow,
              hasToolbar ? 'items-start' : 'items-center',
            )}
          >
            {titleRow}
          </div>
        </header>
      )}
      {hasStepAside ? (
        <RevealRegion
          surface="subtle"
          header={
            <DrawerHeaderMore
              isOverlay={isOverlay}
              meta={meta}
              metaInsetPx={Icon == null ? HEADER_INSET_PX : META_INSET_WITH_ICON_PX}
              toolbar={toolbar}
            />
          }
        >
          {backLink}
          {body}
        </RevealRegion>
      ) : (
        <HeaderRevealContext.Provider value={null}>
          {backLink}
          {body}
        </HeaderRevealContext.Provider>
      )}
      {dock != null ? (
        <div ref={dockRef} className="shrink-0 px-4 py-3">
          {dock}
        </div>
      ) : null}
    </section>
  );
};
