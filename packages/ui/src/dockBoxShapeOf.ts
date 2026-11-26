import type { DockGridColumnBox } from './dockGridColumnBox';

type ShapeParams = {
  readonly boxes: ReadonlyArray<DockGridColumnBox>;
};

export const dockBoxShapeOf = ({ boxes }: ShapeParams): string =>
  JSON.stringify(
    boxes.map((box) => [
      box.width,
      box.panes.map((pane) => [pane.key, [...(pane.tabs ?? [])].sort()]),
    ]),
  );
