import { DRAWER_GUTTER } from './drawerGeometry';
import type { DockGridColumnBox } from './dockGridColumnBox';

type SpanParams = {
  readonly columns: ReadonlyArray<DockGridColumnBox>;
};

export const dockGridSpanOf = ({ columns }: SpanParams): number =>
  columns.reduce((total, column) => total + column.width, 0) +
  DRAWER_GUTTER * Math.max(0, columns.length - 1);
