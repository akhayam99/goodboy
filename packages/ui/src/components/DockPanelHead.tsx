import { useContext, useLayoutEffect, useRef, type PointerEvent, type ReactNode } from 'react';
import { cn } from '../cn';
import { DrawerBackChipContext } from '../drawerBackChipContext';
import { DockDragContext } from '../dockDragContext';
import { DockTabsContext } from '../dockTabsContext';
import { X } from '../icons';
import type { IconGlyph } from '../icons';
import { ICON_SIZE } from '../iconSize';
import { useDockGrip } from '../useDockGrip';
import { useIsNarrow } from '../useIsNarrow';
import type { DrawerPage } from './DrawerFrame';
import { DrawerHeadKeys } from './DrawerHeadKeys';
import { DrawerBackChip } from './DrawerBackChip';
import { IconButton } from './IconButton';
import { SegmentedTabs } from './SegmentedTabs';

const NARROW_HEAD_PX = 360;

type PressParams = {
  readonly event: PointerEvent<HTMLElement>;
};

type Props = {
  readonly title: string;
  readonly titleContent?: ReactNode;
  readonly icon?: IconGlyph;
  readonly iconClassName?: string;
  readonly count?: ReactNode;
  readonly actions?: ReactNode;
  readonly menu?: ReactNode;
  readonly page?: DrawerPage;
  readonly onClose: () => void;
};

export const DockPanelHead = ({
  title,
  titleContent,
  icon: Icon,
  iconClassName,
  count,
  actions,
  menu,
  page,
  onClose,
}: Props) => {
  const grip = useDockGrip();
  const row = useIsNarrow({ below: NARROW_HEAD_PX });
  const source = useContext(DockDragContext);
  const tabs = useContext(DockTabsContext);
  const strip = useRef<HTMLDivElement | null>(null);
  const backChip = useContext(DrawerBackChipContext);
  const claim = tabs?.claim;
  const takeFocus = tabs?.takeFocus;
  const paneKey = tabs?.paneKey;

  useLayoutEffect(() => {
    if (claim === undefined || takeFocus === undefined || paneKey === undefined) {
      return;
    }
    const release = claim({ paneKey });
    if (takeFocus({ paneKey })) {
      strip.current?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus();
    }
    return release;
  }, [claim, takeFocus, paneKey]);

  const press = ({ event }: PressParams): void => {
    const { target } = event;
    if (!(target instanceof Element)) {
      return;
    }
    const tab = target.closest('[data-dock-tab]');
    if (tab !== null && event.currentTarget.contains(tab)) {
      const key = tab.getAttribute('data-dock-tab');
      if (key !== null) {
        source?.onStartPanel?.({ event, key });
      }
      return;
    }
    grip.press({ event });
  };

  return (
    <div
      ref={row.ref}
      data-dock-panel-head=""
      data-drawer-header-row=""
      data-head-folded={row.isNarrow ? '' : undefined}
      data-dock-drag-source={grip.canDrag ? '' : undefined}
      onPointerDown={grip.canDrag ? (event) => press({ event }) : undefined}
      className={cn(
        'flex h-10 min-w-0 shrink-0 items-center gap-2 px-2 pt-2',
        grip.canDrag && 'cursor-grab',
      )}
    >
      {backChip === null ? null : <DrawerBackChip chip={backChip} />}
      {tabs === null ? (
        <div className="flex min-w-0 flex-1 items-center gap-2 pl-2">
          {Icon == null ? null : (
            <Icon
              size={ICON_SIZE.control}
              aria-hidden
              className={cn('shrink-0 text-faint-foreground', iconClassName)}
            />
          )}
          {titleContent != null ? (
            <div className="flex min-w-0 items-center text-heading text-foreground">
              {titleContent}
            </div>
          ) : (
            <h2 className="min-w-0 truncate text-heading text-foreground">{title}</h2>
          )}
          {count != null ? (
            <span className="flex min-w-0 shrink-[4] items-center text-meta tabular-nums text-muted-foreground">
              {count}
            </span>
          ) : null}
        </div>
      ) : (
        <div ref={strip} data-dock-cell-tabs="" className="flex min-w-0 flex-1 items-center">
          <SegmentedTabs
            size="xs"
            ariaLabel="Panels"
            value={tabs.shown}
            options={tabs.options.map((option) => ({ ...option, handleKey: option.value }))}
            onChange={(key) => tabs.onSelect({ key })}
          />
        </div>
      )}
      <div className="flex shrink-0 items-center gap-1">
        {actions}
        {menu}
        <DrawerHeadKeys page={page} title={title} isFolded={row.isNarrow} hasMenu={menu != null} />
        <IconButton icon={X} label="Close" variant="ghost" onClick={onClose} />
      </div>
    </div>
  );
};
