import {
  RAIL_CONTENT_PAD,
  RAIL_LABEL_GAP,
  RAIL_MARKER_RADIUS,
  railColumnX,
} from '../../../workTreeModel/railGeometry';

export const RUN_TREE_SLOT_WIDTH =
  railColumnX({ column: 1 }) + RAIL_MARKER_RADIUS + RAIL_LABEL_GAP - RAIL_CONTENT_PAD;
