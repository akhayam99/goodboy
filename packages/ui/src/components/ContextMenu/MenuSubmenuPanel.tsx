import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../cn';
import { FLOATING_SURFACE } from '../../floatingSurface';
import { MenuRow } from './MenuRow';
import { focusFirstMenuItem, isMenuNavigationKey, moveMenuFocus } from './menuKeys';
import type { MenuItemEntry } from './menuTypes';

const PANEL_WIDTH = 200;
const EDGE = 8;
const GAP = 4;

type Props = {
  readonly label: string;
  readonly items: ReadonlyArray<MenuItemEntry>;
  readonly anchor: HTMLElement;
  readonly onChoose: (entry: MenuItemEntry) => void;
  readonly onBack: () => void;
};

type KeyParams = {
  readonly event: KeyboardEvent<HTMLDivElement>;
};

type Position = {
  readonly left: number;
  readonly top: number;
};

export const MenuSubmenuPanel = ({ label, items, anchor, onChoose, onBack }: Props) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(null);

  useLayoutEffect(() => {
    const rect = anchor.getBoundingClientRect();
    const height = panelRef.current?.offsetHeight ?? 0;
    const canFitRight = rect.right + GAP + PANEL_WIDTH <= window.innerWidth - EDGE;
    const left = canFitRight ? rect.right + GAP : Math.max(EDGE, rect.left - GAP - PANEL_WIDTH);
    const top = Math.max(EDGE, Math.min(rect.top - GAP, window.innerHeight - EDGE - height));
    setPosition({ left, top });
  }, [anchor]);

  useLayoutEffect(() => {
    if (position === null || panelRef.current === null) {
      return;
    }
    focusFirstMenuItem({ container: panelRef.current });
  }, [position]);

  const handleKey = ({ event }: KeyParams) => {
    const container = panelRef.current;
    if (container === null) {
      return;
    }
    if (isMenuNavigationKey(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      moveMenuFocus({ container, key: event.key });
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      event.stopPropagation();
      onBack();
    }
  };

  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      aria-label={label}
      data-menu-panel
      data-menu-portal
      onKeyDown={(event) => handleKey({ event })}
      style={{
        left: position?.left ?? 0,
        top: position?.top ?? 0,
        width: PANEL_WIDTH,
        visibility: position === null ? 'hidden' : 'visible',
      }}
      className={cn(
        FLOATING_SURFACE,
        'fixed z-popover flex max-h-80 flex-col p-1 text-meta motion-safe:animate-popover-in',
      )}
    >
      {items.map((item) => (
        <MenuRow
          key={item.key}
          entry={item}
          isExpanded={false}
          onActivate={() => {
            if (item.blockedReason != null || item.isDisabled === true) {
              return;
            }
            onChoose(item);
          }}
          onHover={() => undefined}
          onKeyDown={() => undefined}
        />
      ))}
    </div>,
    document.body,
  );
};
