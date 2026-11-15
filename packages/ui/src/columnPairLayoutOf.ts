import {
  panelPairLayoutOf,
  type DrawerPanelSpec,
  type DrawerPlacement,
  type PanelPairLayout,
} from './drawerGeometry';
import { unmeasuredLayoutOf } from './unmeasuredLayoutOf';

type Params = {
  readonly columnWidth: number | null;
  readonly railWidth: number;
  readonly placement: DrawerPlacement;
  readonly dock: DrawerPanelSpec;
  readonly detail: DrawerPanelSpec;
};

export const columnPairLayoutOf = ({
  columnWidth,
  railWidth,
  placement,
  dock,
  detail,
}: Params): PanelPairLayout => {
  if (columnWidth !== null) {
    return panelPairLayoutOf({
      main: columnWidth,
      contentInset: railWidth,
      edgeWidth: railWidth,
      placement,
      dock,
      detail,
    });
  }
  const lead = detail.isOpen && !dock.isOpen ? detail : dock;
  return {
    mode: unmeasuredLayoutOf({ savedWidth: lead.savedWidth, sizing: lead.sizing, placement }).mode,
    dock: unmeasuredLayoutOf({ savedWidth: dock.savedWidth, sizing: dock.sizing, placement }),
    detail: unmeasuredLayoutOf({ savedWidth: detail.savedWidth, sizing: detail.sizing, placement }),
  };
};
