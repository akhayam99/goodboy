import type { DockGridColumnBox } from './dockGridColumnBox';
import { DOCK_ROW_MIN_PX } from './dockRowMin';
import { DRAWER_GUTTER } from './drawerGeometry';

type Params = {
  readonly columns: ReadonlyArray<DockGridColumnBox>;
};

type Tracks = {
  readonly columns: string;
  readonly rows: string;
};

const GUTTER_TRACK = `${DRAWER_GUTTER}px`;

const ROW_MIN = `${DOCK_ROW_MIN_PX}px`;

export const dockGridTracksOf = ({ columns }: Params): Tracks => {
  const split = columns.find((column) => column.panes.length > 1);
  const [top, bottom] = split?.panes ?? [];
  return {
    columns: columns.map((column) => `${column.width}px`).join(` ${GUTTER_TRACK} `),
    rows:
      top === undefined || bottom === undefined
        ? 'minmax(0,1fr)'
        : `minmax(${ROW_MIN},${top.weight}fr) ${GUTTER_TRACK} minmax(${ROW_MIN},${bottom.weight}fr)`,
  };
};
