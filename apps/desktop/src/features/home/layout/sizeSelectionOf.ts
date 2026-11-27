import type { HomeWidgetId, WidgetSize } from '../grid/homeWidgets';

type ResizeParams = {
  readonly id: HomeWidgetId;
  readonly size: WidgetSize;
};

type Params = {
  readonly id: HomeWidgetId;
  readonly sizes: ReadonlyArray<WidgetSize>;
  readonly onResize: (params: ResizeParams) => void;
};

export const sizeSelectionOf =
  ({ id, sizes, onResize }: Params) =>
  (choice: string | null): void => {
    const size = sizes.find((candidate) => candidate === choice);
    if (size !== undefined) {
      onResize({ id, size });
    }
  };
