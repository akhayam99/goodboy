import {
  DRAWER_TIERS,
  type DrawerLayout,
  type DrawerPlacement,
  type DrawerSizing,
} from './drawerGeometry';

type Params = {
  readonly savedWidth: number;
  readonly sizing: DrawerSizing;
  readonly placement: DrawerPlacement;
};

export const unmeasuredLayoutOf = ({ savedWidth, sizing, placement }: Params): DrawerLayout => ({
  mode: placement === 'overlay' ? 'overlay' : 'push',
  width: savedWidth,
  dragMax: DRAWER_TIERS[sizing].max,
});
