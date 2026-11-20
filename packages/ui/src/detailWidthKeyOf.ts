import type { DrawerSizing } from './drawerGeometry';

type Params = {
  readonly kind: string | null;
  readonly sizing: DrawerSizing;
};

export const detailWidthKeyOf = ({ kind, sizing }: Params): string =>
  `goodboy:detail-width:${kind ?? sizing}:v1`;
