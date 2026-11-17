import type { DrawerSizing } from './drawerGeometry';

const SIZING_RANK: Readonly<Record<DrawerSizing, number>> = { side: 0, reader: 1, browser: 2 };

type Params = {
  readonly sizings: ReadonlyArray<DrawerSizing>;
};

export const dockLeadSizingOf = ({ sizings }: Params): DrawerSizing =>
  sizings.reduce<DrawerSizing>(
    (lead, sizing) => (SIZING_RANK[sizing] > SIZING_RANK[lead] ? sizing : lead),
    'side',
  );
