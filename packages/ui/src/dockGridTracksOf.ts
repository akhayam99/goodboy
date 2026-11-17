import type { DockGridColumnBox } from './dockGridColumnBox';
import { DRAWER_GUTTER } from './drawerGeometry';

type Params = {
  readonly columns: ReadonlyArray<DockGridColumnBox>;
};

type Tracks = {
  readonly columns: string;
  readonly rows: string;
};

const GUTTER_TRACK = `${DRAWER_GUTTER}px`;

export const dockGridTracksOf = ({ columns }: Params): Tracks => {
  const split = columns.find((column) => column.panes.length > 1);
  const [top, bottom] = split?.panes ?? [];
  return {
    columns: columns.map((column) => `${column.width}px`).join(` ${GUTTER_TRACK} `),
    rows:
      top === undefined || bottom === undefined
        ? 'minmax(0,1fr)'
        : `minmax(0,${top.weight}fr) ${GUTTER_TRACK} minmax(0,${bottom.weight}fr)`,
  };
};
