import type { HomeWidgetId, WidgetSize } from './homeWidgets';
import type { WidgetGesture } from '../layout/layoutTypes';

export type ReorderParams = {
  readonly id: HomeWidgetId;
  readonly beforeId: HomeWidgetId | null;
};

export type ResizeParams = {
  readonly id: HomeWidgetId;
  readonly size: WidgetSize;
};

export type StepParams = {
  readonly id: HomeWidgetId;
  readonly step: 1 | -1;
};

export type GridEditing = {
  readonly onHide: (params: WidgetGesture) => void;
  readonly onReorder: (params: ReorderParams) => void;
  readonly onResize: (params: ResizeParams) => void;
  readonly onStepMove: (params: StepParams) => void;
  readonly leavingId: HomeWidgetId | null;
  readonly arrivingId: HomeWidgetId | null;
};
