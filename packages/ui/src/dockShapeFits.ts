import { dockLayoutOf, type DockPane } from './dockLayout';
import { dockMoveFits } from './dockMoveFits';

type Shape = ReadonlyArray<ReadonlyArray<DockPane>>;

type LayoutParams = {
  readonly windowWidth: number;
  readonly detail: DockPane | null;
  readonly columns: Shape;
};

type Params = LayoutParams & {
  readonly before: Shape;
};

const FRAME_HEIGHT = 1000;

const layoutOf = ({ windowWidth, detail, columns }: LayoutParams) =>
  dockLayoutOf({
    windowWidth,
    windowHeight: FRAME_HEIGHT,
    top: 0,
    detail,
    columns: columns.map((panes) => ({ panes })),
  });

export const dockShapeFits = ({ windowWidth, detail, columns, before }: Params): boolean =>
  dockMoveFits({
    now: layoutOf({ windowWidth, detail, columns: before }),
    next: layoutOf({ windowWidth, detail, columns }),
  });
