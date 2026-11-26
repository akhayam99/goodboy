import type { DockDropZone } from './dockDropZonesOf';
import type { DockGridColumnBox } from './dockGridColumnBox';
import { dockGroupLeadOf } from './dockGroupLeadOf';

type Params = {
  readonly zone: DockDropZone;
  readonly dragKey: string;
  readonly boxes: ReadonlyArray<DockGridColumnBox>;
};

type KeyParams = Pick<Params, 'boxes'> & {
  readonly key: string;
};

type PlaceParams = {
  readonly column: number;
  readonly row: number;
};

const dockCardPlaceOf = ({ boxes, key }: KeyParams): PlaceParams | null => {
  const column = boxes.findIndex((box) => box.panes.some((pane) => pane.key === key));
  const row = boxes[column]?.panes.findIndex((pane) => pane.key === key) ?? -1;
  return column < 0 || row < 0 ? null : { column, row };
};

export const dockCardHonestOf = ({ zone, dragKey, boxes }: Params): boolean => {
  const lead = dockGroupLeadOf({ groups: zone.layout.groups, key: dragKey }) ?? dragKey;
  if (zone.placement === 'merge') {
    const target = boxes.flatMap((box) => box.panes).find((pane) => pane.key === zone.paneKey);
    return target !== undefined && target.tabs?.includes(dragKey) === true;
  }
  const own = dockCardPlaceOf({ boxes, key: lead });
  if (own === null) {
    return false;
  }
  if (zone.scope === 'dock') {
    return zone.placement === 'left' ? own.column === 0 : own.column === boxes.length - 1;
  }
  const other = zone.paneKey === null ? null : dockCardPlaceOf({ boxes, key: zone.paneKey });
  if (other === null) {
    return false;
  }
  if (zone.placement === 'above') {
    return own.column === other.column && own.row < other.row;
  }
  if (zone.placement === 'below') {
    return own.column === other.column && own.row > other.row;
  }
  return zone.placement === 'left'
    ? own.column === other.column - 1
    : own.column === other.column + 1;
};
