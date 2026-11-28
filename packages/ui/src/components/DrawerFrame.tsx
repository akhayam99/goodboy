import { DockPanelHead } from './DockPanelHead';
import { DrawerTitleGrip } from './DrawerTitleGrip';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { IconGlyph } from '../icons';
import { X } from '../icons';
import { cn } from '../cn';
import { useEscapeLayer } from '../useEscapeLayer';
import { useIsNarrow } from '../useIsNarrow';
import { FIELD_SELECTOR, focusableTrigger, hasDraft } from '../drawerFrameFocus';
import { DrawerBackLink } from './DrawerBackLink';
import { DrawerHeaderMore } from './DrawerHeaderMore';
import { DrawerHeadKeys } from './DrawerHeadKeys';
import { IconButton } from './IconButton';
import { ScrollFade } from './ScrollFade';
import { DrawerRegion } from './DrawerRegion';
import { HeaderRevealContext } from '../useHeaderReveal/headerRevealContext';
import { PANE_RHYTHM } from '../paneRhythm';
import { ICON_SIZE } from '../iconSize';

export type DrawerBack = {
  readonly label: string;
  readonly onBack: () => void;
};

export type DrawerPage = {
  readonly label?: string;
  readonly tooltip?: string;
  readonly onOpen: () => void;
};

export type DrawerFrameProps = {
  readonly title: string;
  readonly titleContent?: ReactNode;
  readonly icon?: IconGlyph;
  readonly iconClassName?: string;
  readonly count?: ReactNode;
  readonly meta?: ReactNode;
  readonly action?: ReactNode;
  readonly menu?: ReactNode;
  readonly page?: DrawerPage;
  readonly toolbar?: ReactNode;
  readonly back?: DrawerBack | undefined;
  readonly onClose: () => void;
  readonly dock?: ReactNode;
  readonly scroll?: 'frame' | 'self';
  readonly isHeaderless?: boolean;
  readonly isDock?: boolean;
  readonly children: ReactNode;
};

const HEADER_INSET_PX = 16;

const NARROW_HEAD_PX = 360;

const META_INSET_WITH_ICON_PX = HEADER_INSET_PX + ICON_SIZE.control + 8;

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
  onClose,
  dock,
  scroll = 'frame',
  isHeaderless = false,
  isDock = false,
  children,
}: DrawerFrameProps) => {
  const [trigger] = useState(focusableTrigger);
  const head = useIsNarrow({ below: NARROW_HEAD_PX });
  const sectionRef = useRef<HTMLElement | null>(null);
  const dockRef = useRef<HTMLDivElement | null>(null);
  const hasToolbar = toolbar != null;
  const stepBack = back === undefined || isHeaderless ? undefined : back.onBack;

  useEscapeLayer(() => {
    const active = document.activeElement;
    const section = sectionRef.current;
    if (
      active instanceof HTMLElement &&
      section !== null &&
      section.contains(active) &&
      hasDraft({ element: active })
    ) {
      active.blur();
      return;
    }
    (stepBack ?? onClose)();
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
      <DrawerTitleGrip isTop={hasToolbar}>
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
          <div className="flex h-5 min-w-0 items-center text-heading text-foreground">
            {titleContent}
          </div>
        ) : (
          <h2
            className={cn(
              'min-w-0 text-heading text-foreground',
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
      </DrawerTitleGrip>
      <div className={cn('flex shrink-0 items-center gap-1', hasToolbar && 'h-5')}>
        {action}
        {menu}
        <DrawerHeadKeys page={page} />
        <IconButton icon={X} label="Close" variant="ghost" onClick={onClose} />
      </div>
    </>
  );

  const hasStepAside = !isHeaderless && (isDock ? hasToolbar : meta != null || hasToolbar);
  const backLink =
    back === undefined || stepBack === undefined ? null : <DrawerBackLink back={back} />;
  const body =
    scroll === 'self' || isHeaderless ? (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    ) : (
      <ScrollFade className="min-h-0 flex-1" viewportClassName="px-4 py-3" fadeSize={24}>
        {children}
      </ScrollFade>
    );

  const hasRegion = !isHeaderless && (hasStepAside || scroll === 'self');
  const header = isHeaderless ? null : (
    <header
      data-drawer-header=""
      className={cn(
        'flex shrink-0 flex-col',
        !isDock && PANE_RHYTHM.headerInset,
        !hasStepAside && 'pb-2',
      )}
    >
      {isDock ? (
        <DockPanelHead
          title={title}
          titleContent={titleContent}
          icon={Icon}
          iconClassName={iconClassName}
          count={count ?? meta}
          actions={action}
          menu={menu}
          page={page}
          onClose={onClose}
        />
      ) : (
        <div
          ref={head.ref}
          data-drawer-header-row=""
          data-head-folded={head.isNarrow ? '' : undefined}
          className={cn(
            'flex min-w-0 gap-2 pl-4 pr-2',
            hasToolbar ? 'min-h-8' : PANE_RHYTHM.headerRow,
            hasToolbar ? 'items-start' : 'items-center',
          )}
        >
          {titleRow}
        </div>
      )}
    </header>
  );

  return (
    <section
      ref={sectionRef}
      aria-label={title}
      tabIndex={-1}
      className="flex h-full min-h-0 min-w-0 flex-col bg-panel-surface outline-none motion-safe:animate-nav-step-in"
    >
      {hasRegion ? (
        <DrawerRegion
          header={header}
          stepAside={
            hasStepAside ? (
              <DrawerHeaderMore
                meta={meta}
                metaInsetPx={Icon == null ? HEADER_INSET_PX : META_INSET_WITH_ICON_PX}
                toolbar={toolbar}
                isDock={isDock}
              />
            ) : null
          }
        >
          {backLink}
          {body}
        </DrawerRegion>
      ) : (
        <>
          {header}
          <HeaderRevealContext.Provider value={null}>
            {backLink}
            {body}
          </HeaderRevealContext.Provider>
        </>
      )}
      {dock != null ? (
        <div ref={dockRef} className="shrink-0 px-4 py-3">
          {dock}
        </div>
      ) : null}
    </section>
  );
};
