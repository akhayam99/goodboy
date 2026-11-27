import type { HomeWidgetId, WidgetSize } from '../grid/homeWidgets';

export type HomeLayoutEntry = {
  readonly id: HomeWidgetId;
  readonly size: WidgetSize;
};

export type HomeLayout = ReadonlyArray<HomeLayoutEntry>;

export const HOME_LAYOUT_KEY = 'home.layout' as const;

export const HOME_LAYOUT_VERSION = 1;

export type WidgetGesture = {
  readonly id: HomeWidgetId;
};

export type WidgetMenuOpen = {
  readonly opener: HTMLElement;
};

export type ReorderStepParams = {
  readonly id: HomeWidgetId;
  readonly step: 1 | -1;
  readonly isWrapping: boolean;
};
