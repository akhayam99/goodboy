import { HOME_WIDGETS, type HomeWidgetId } from '../grid/homeWidgets';

type Params = {
  readonly kind: 'grab' | 'move' | 'drop' | 'cancel' | 'step';
  readonly id: HomeWidgetId;
  readonly ids: ReadonlyArray<HomeWidgetId>;
};

export const reorderMessageOf = ({ kind, id, ids }: Params): string => {
  const title = HOME_WIDGETS[id].title;
  const spot = `position ${ids.indexOf(id) + 1} of ${ids.length}`;
  switch (kind) {
    case 'grab':
      return `Grabbed ${title}, ${spot}. Use the arrow keys to move, Space to drop, Escape to cancel.`;
    case 'move':
      return `${title}, ${spot}.`;
    case 'drop':
      return `Dropped ${title} at ${spot}.`;
    case 'cancel':
      return `Cancelled. ${title} is back at ${spot}.`;
    case 'step':
      return `${title} moved to ${spot}`;
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
};
