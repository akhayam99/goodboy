import type { DrawerSizing } from './drawerGeometry';

export type DockPane = {
  readonly id: string;
  readonly sizing: DrawerSizing;
  readonly savedWidth: number;
  readonly rowMin?: number;
};

export type DockColumn = {
  readonly panes: ReadonlyArray<DockPane>;
  readonly savedWidth?: number;
  readonly split?: number;
};

export type LanePane = DockPane & {
  readonly tabs?: ReadonlyArray<string>;
};

export type Lane = {
  readonly panes: ReadonlyArray<LanePane>;
  readonly sizing: DrawerSizing;
  readonly savedWidth: number;
  readonly split: number;
};
