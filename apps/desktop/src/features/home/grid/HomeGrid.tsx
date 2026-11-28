import type { ReactNode } from 'react';
import { HOME_WIDGETS, type HomeWidgetId, type WidgetSize } from './homeWidgets';
import { placeWidgets, type WidgetRequest } from './placeWidgets';
import { useHomeColumns } from '../hooks/useHomeColumns';

type RenderParams = {
  readonly id: HomeWidgetId;
  readonly size: WidgetSize;
};

type Props = {
  readonly ids: ReadonlyArray<HomeWidgetId>;
  readonly render: (params: RenderParams) => ReactNode;
};

export const HomeGrid = ({ ids, render }: Props) => {
  const { ref, columns } = useHomeColumns();
  const requests: ReadonlyArray<WidgetRequest> = ids.map((id) => ({
    id,
    size: HOME_WIDGETS[id].defaultSize,
  }));
  const placed = placeWidgets({ requests, columns });
  return (
    <div
      ref={ref}
      data-home-grid=""
      data-columns={columns}
      className="grid min-w-0 gap-3 [grid-auto-rows:minmax(56px,auto)]"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {placed.map((widget) => (
        <div
          key={widget.id}
          className="flex min-h-0 min-w-0 flex-col"
          style={{
            gridColumn: `${widget.col + 1} / span ${widget.cols}`,
            gridRow: `${widget.row + 1} / span ${widget.rows}`,
          }}
        >
          {render({ id: widget.id, size: widget.size })}
        </div>
      ))}
    </div>
  );
};
