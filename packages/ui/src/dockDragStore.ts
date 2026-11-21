import type { DockDropZone } from './dockDropZonesOf';

export type DockDragView = {
  readonly key: string;
  readonly title: string;
  readonly x: number;
  readonly y: number;
  readonly zones: ReadonlyArray<DockDropZone>;
  readonly hoverId: string | null;
};

type Listener = () => void;

type SetParams = {
  readonly view: DockDragView | null;
};

type SubscribeParams = {
  readonly listener: Listener;
};

export type DockDragStore = {
  readonly get: () => DockDragView | null;
  readonly set: (params: SetParams) => void;
  readonly subscribe: (params: SubscribeParams) => () => void;
};

export const createDockDragStore = (): DockDragStore => {
  let current: DockDragView | null = null;
  const listeners = new Set<Listener>();
  return {
    get: () => current,
    set: ({ view }) => {
      current = view;
      listeners.forEach((listener) => listener());
    },
    subscribe: ({ listener }) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
};
