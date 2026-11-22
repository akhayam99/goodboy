import { useCallback, useRef, type MutableRefObject, type RefObject } from 'react';
import { DRAWER_GUTTER, panelAsideWidthOf, type DrawerMode } from '../drawerGeometry';
import { DRAWER_PANEL_VARS } from '../drawerPanelVars';

type LiveWidths = {
  readonly mode: DrawerMode;
  readonly rail: number;
  readonly dock: number;
  readonly detail: number;
  readonly isDetailOver: boolean;
  readonly isPinned: boolean;
};

type Params = {
  readonly asideRef: RefObject<HTMLElement | null>;
  readonly trackRef: RefObject<HTMLDivElement | null>;
  readonly groupRef: RefObject<HTMLDivElement | null>;
};

type DrawerPreview = {
  readonly live: MutableRefObject<LiveWidths>;
  readonly previewDock: (next: number) => void;
  readonly previewDetail: (next: number) => void;
};

export const useDrawerPreview = ({ asideRef, trackRef, groupRef }: Params): DrawerPreview => {
  const live = useRef<LiveWidths>({
    mode: 'closed',
    rail: 0,
    dock: 0,
    detail: 0,
    isDetailOver: false,
    isPinned: false,
  });
  const previewAside = useCallback(() => {
    const { mode, rail, dock, detail, isPinned } = live.current;
    if (isPinned) {
      return;
    }
    const track = `${panelAsideWidthOf({ dockWidth: dock, detailWidth: detail, railWidth: rail })}px`;
    asideRef.current?.style.setProperty('width', track);
    if (mode === 'overlay') {
      trackRef.current?.style.setProperty('min-width', track);
    }
  }, [asideRef, trackRef]);
  const previewDock = useCallback(
    (next: number) => {
      live.current = { ...live.current, dock: live.current.dock > 0 ? next : 0 };
      asideRef.current?.style.setProperty(DRAWER_PANEL_VARS.dock, `${next}px`);
      previewAside();
    },
    [asideRef, previewAside],
  );
  const previewDetail = useCallback(
    (next: number) => {
      asideRef.current?.style.setProperty(DRAWER_PANEL_VARS.detail, `${next}px`);
      groupRef.current?.style.setProperty('width', `${next + DRAWER_GUTTER}px`);
      if (live.current.isDetailOver) {
        return;
      }
      live.current = { ...live.current, detail: next };
      previewAside();
    },
    [asideRef, groupRef, previewAside],
  );
  return { live, previewDock, previewDetail };
};
