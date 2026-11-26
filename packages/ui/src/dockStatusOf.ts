import type { DockDropZone } from './dockDropZonesOf';
import type { DockGhostFold } from './dockGhostOf';
import type { DockDragPosition } from './dockDragStore';

export const DOCK_IDLE_STATUS = 'Drop on a highlighted area, Esc to cancel.';

type Params = {
  readonly zone: DockDropZone | null;
  readonly names: Readonly<Record<string, string>>;
  readonly isSwap: boolean;
  readonly folds: ReadonlyArray<DockGhostFold>;
  readonly position: DockDragPosition | null;
};

type NameParams = {
  readonly names: Readonly<Record<string, string>>;
  readonly key: string;
};

const MAX_NAMED = 2;

export const dockNameOf = ({ names, key }: NameParams): string => names[key] ?? key;

export const dockFoldLineOf = ({
  names,
  folds,
}: Pick<Params, 'names' | 'folds'>): string | null => {
  const first = folds[0];
  if (first === undefined) {
    return null;
  }
  const named = folds.slice(0, MAX_NAMED).map(({ key }) => dockNameOf({ names, key }));
  const rest = folds.length - named.length;
  const list = rest > 0 ? `${named.join(', ')} +${rest} more` : named.join(' and ');
  return `Folds ${list} into ${dockNameOf({ names, key: first.into })}`;
};

const placeLineOf = ({
  zone,
  names,
  isSwap,
}: Pick<Params, 'zone' | 'names' | 'isSwap'>): string => {
  if (zone === null) {
    return DOCK_IDLE_STATUS;
  }
  if (zone.scope === 'dock') {
    return `${zone.label} of the dock`;
  }
  const name = zone.paneKey === null ? '' : dockNameOf({ names, key: zone.paneKey });
  if (zone.placement === 'merge') {
    return isSwap ? `Swap with ${name}` : `Merge into ${name} as a tab`;
  }
  return zone.placement === 'above' || zone.placement === 'below'
    ? `${zone.label} ${name}`
    : `${zone.label} of ${name}`;
};

export const dockStatusOf = ({ zone, names, isSwap, folds, position }: Params): string => {
  const place = placeLineOf({ zone, names, isSwap });
  if (zone === null) {
    return place;
  }
  const counted = position === null ? place : `${place}, ${position.index} of ${position.total}`;
  const fold = dockFoldLineOf({ names, folds });
  return fold === null ? counted : `${counted}. ${fold}`;
};
