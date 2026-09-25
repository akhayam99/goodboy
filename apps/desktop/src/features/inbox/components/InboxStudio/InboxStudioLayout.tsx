import { useState, type ReactNode, type Ref } from 'react';
import {
  Divider,
  RIGHT_DRAWER_DEFAULT,
  RIGHT_DRAWER_MAX,
  RIGHT_DRAWER_MIN,
  RIGHT_DRAWER_STORAGE_KEY,
  ResizeHandle,
  canDrawerPush,
  cn,
} from '@goodboy/ui';
import { useElementWidth } from '../../../../shared/hooks/useElementWidth';

type Props = {
  readonly bodyRef?: Ref<HTMLDivElement>;
  readonly rail: ReactNode;
  readonly list: ReactNode;
  readonly drawer: ReactNode;
  readonly drawerRef?: Ref<HTMLElement>;
};

const readDrawerWidth = (): number => {
  try {
    const parsed = Number.parseInt(localStorage.getItem(RIGHT_DRAWER_STORAGE_KEY) ?? '', 10);
    if (Number.isNaN(parsed)) {
      return RIGHT_DRAWER_DEFAULT;
    }
    return Math.max(RIGHT_DRAWER_MIN, Math.min(RIGHT_DRAWER_MAX, parsed));
  } catch {
    return RIGHT_DRAWER_DEFAULT;
  }
};

export const InboxStudioLayout = ({ bodyRef, rail, list, drawer, drawerRef }: Props) => {
  const outer = useElementWidth();
  const [drawerWidth, setDrawerWidth] = useState(readDrawerWidth);
  const isDrawerOpen = drawer != null;
  const isOverlay =
    isDrawerOpen &&
    outer.width !== null &&
    !canDrawerPush({ mainWidthPx: outer.width, drawerWidthPx: drawerWidth });

  const resize = (width: number) => {
    setDrawerWidth(width);
    try {
      localStorage.setItem(RIGHT_DRAWER_STORAGE_KEY, String(width));
    } catch {
      return;
    }
  };

  return (
    <div ref={outer.ref} className="relative flex h-full min-h-0 flex-1">
      <div ref={bodyRef} className="flex min-h-0 min-w-0 flex-1">
        {rail == null ? null : (
          <aside aria-label="Inbox filters" className="flex min-h-0 w-64 shrink-0 flex-col">
            {rail}
          </aside>
        )}
        {rail == null ? null : <Divider orientation="vertical" />}
        <div className="min-h-0 min-w-0 flex-1">{list}</div>
      </div>
      {isDrawerOpen ? (
        <aside
          ref={drawerRef}
          aria-label="Inbox item"
          data-drawer-mode={isOverlay ? 'overlay' : 'push'}
          style={{ width: drawerWidth }}
          className={cn(
            'flex min-h-0 shrink-0 bg-background motion-safe:animate-nav-step-in',
            isOverlay && 'absolute inset-y-0 right-0 z-20 shadow-xl',
          )}
        >
          <ResizeHandle
            value={drawerWidth}
            min={RIGHT_DRAWER_MIN}
            max={RIGHT_DRAWER_MAX}
            onChange={resize}
            onReset={() => resize(RIGHT_DRAWER_DEFAULT)}
            side="right"
            ariaLabel="Resize the item panel"
          />
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">{drawer}</div>
        </aside>
      ) : null}
    </div>
  );
};
