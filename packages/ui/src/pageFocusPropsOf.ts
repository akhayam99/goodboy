import { DOCK_FOCUS_PAGE, type DockGridSpec } from './dockGridSpec';

type Params = {
  readonly dockGrid: DockGridSpec | null;
};

type PageFocusProps = {
  readonly 'data-dock-focus'?: string;
  readonly tabIndex?: number;
  readonly onFocusCapture?: () => void;
  readonly onPointerDownCapture?: () => void;
};

export const pageFocusPropsOf = ({ dockGrid }: Params): PageFocusProps => {
  if (dockGrid === null) {
    return {};
  }
  const focusPage = () => dockGrid.onFocus({ key: DOCK_FOCUS_PAGE });
  return {
    'data-dock-focus': DOCK_FOCUS_PAGE,
    tabIndex: -1,
    onFocusCapture: focusPage,
    onPointerDownCapture: focusPage,
  };
};
