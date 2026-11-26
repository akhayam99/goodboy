import type { DockDragSource } from './dockDragContext';
import type { useDockDrag } from './useDockDrag';

type Params = {
  readonly shown: string;
  readonly start: ReturnType<typeof useDockDrag>['start'];
  readonly lift: ReturnType<typeof useDockDrag>['lift'];
};

export const dockFoldedSourceOf = ({ shown, start, lift }: Params): DockDragSource => ({
  onStart: ({ event }) => start({ key: shown, unit: 'panel', event }),
  onStartPanel: ({ key, event }) => start({ key, unit: 'panel', event }),
  onLift: ({ element, key }) => lift({ key: key ?? shown, unit: 'panel', element }),
});
