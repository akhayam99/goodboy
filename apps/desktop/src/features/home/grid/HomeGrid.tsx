import { useRef, type ReactNode } from 'react';
import { HOME_WIDGETS, type HomeWidgetId, type WidgetSize } from './homeWidgets';
import type { GridEditing } from './gridEditingTypes';
import { placeWidgets, type WidgetRequest } from './placeWidgets';
import { useGridFlip } from '../hooks/useGridFlip';
import { useHomeColumns } from '../hooks/useHomeColumns';
import { useWidgetReorder } from '../hooks/useWidgetReorder';
import { useWidgetResize } from '../hooks/useWidgetResize';
import { HomeWidgetSlot } from '../layout/HomeWidgetSlot';
import { WidgetAnnouncer } from '../layout/WidgetAnnouncer';

type RenderParams = {
  readonly id: HomeWidgetId;
  readonly size: WidgetSize;
};

type Props = {
  readonly ids: ReadonlyArray<HomeWidgetId>;
  readonly sizes?: Readonly<Partial<Record<HomeWidgetId, WidgetSize>>>;
  readonly editing?: GridEditing;
  readonly render: (params: RenderParams) => ReactNode;
};

const NO_OP = () => undefined;

export const HomeGrid = ({ ids, sizes = {}, editing, render }: Props) => {
  const { ref, columns } = useHomeColumns();
  const storedSizeRef = useRef(sizes);
  storedSizeRef.current = sizes;
  const reorder = useWidgetReorder({
    gridRef: ref,
    ids,
    isEnabled: editing !== undefined,
    onDrop: editing?.onReorder ?? NO_OP,
  });
  const resize = useWidgetResize({
    gridRef: ref,
    columns,
    isEnabled: editing !== undefined,
    sizeOf: ({ id }) => storedSizeRef.current[id] ?? HOME_WIDGETS[id].defaultSize,
    onCommit: editing?.onResize ?? NO_OP,
  });
  const preview = resize.preview;
  useGridFlip({ gridRef: ref, skipId: reorder.via === 'pointer' ? reorder.activeId : null });
  const requests: ReadonlyArray<WidgetRequest> = reorder.liveIds.map((id) => ({
    id,
    size: preview?.id === id ? preview.size : (sizes[id] ?? HOME_WIDGETS[id].defaultSize),
  }));
  const placed = placeWidgets({ requests, columns });
  const isGesture = reorder.activeId !== null || preview !== null;
  return (
    <>
      <div
        ref={ref}
        data-home-grid=""
        data-columns={columns}
        data-gesture={isGesture ? '' : undefined}
        className="relative grid min-w-0 gap-3 [grid-auto-rows:minmax(56px,auto)] [&[data-gesture]_[data-widget-controls]]:opacity-0! [&[data-gesture]_[data-widget-resize-cell]]:opacity-0! [&[data-gesture]_[data-active]_[data-widget-controls]]:opacity-100! [&[data-gesture]_[data-active]_[data-widget-resize-cell]]:opacity-100!"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {placed.map((widget, index) => {
          const content =
            preview?.id === widget.id && preview.contentSize !== widget.size
              ? preview.contentSize
              : widget.size;
          const isLifted = reorder.via === 'pointer' && reorder.activeId === widget.id;
          return (
            <div
              key={widget.id}
              data-home-cell={widget.id}
              className="relative flex min-h-0 min-w-0 flex-col"
              style={{
                gridColumn: `${widget.col + 1} / span ${widget.cols}`,
                gridRow: `${widget.row + 1} / span ${widget.rows}`,
              }}
            >
              {reorder.activeId === widget.id ? (
                <span
                  aria-hidden
                  data-home-placeholder=""
                  className="pointer-events-none absolute inset-0 rounded-lg border-[1.5px] border-dashed border-faint-foreground motion-safe:animate-fade-in"
                />
              ) : null}
              {editing === undefined ? (
                render({ id: widget.id, size: content })
              ) : (
                <HomeWidgetSlot
                  id={widget.id}
                  title={HOME_WIDGETS[widget.id].title}
                  size={sizes[widget.id] ?? HOME_WIDGETS[widget.id].defaultSize}
                  position={{ index, count: placed.length }}
                  isLifted={isLifted}
                  isGrabbed={reorder.activeId === widget.id}
                  isResizing={preview?.id === widget.id}
                  isLeaving={editing.leavingId === widget.id}
                  isArriving={editing.arrivingId === widget.id}
                  onHide={editing.onHide}
                  onStepMove={editing.onStepMove}
                  onResize={editing.onResize}
                  onPointerDown={reorder.onPointerDown}
                  onGripKeyDown={reorder.onGripKeyDown}
                  onResizePointerDown={resize.onPointerDown}
                  onResizeStep={resize.cycle}
                >
                  {render({ id: widget.id, size: content })}
                </HomeWidgetSlot>
              )}
            </div>
          );
        })}
      </div>
      <WidgetAnnouncer message={reorder.announcement} />
    </>
  );
};
