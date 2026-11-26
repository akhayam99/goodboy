import { createContext, type PointerEvent } from 'react';

export type DockDragStart = {
  readonly event: PointerEvent<HTMLElement>;
};

export type DockPanelDragStart = DockDragStart & {
  readonly key: string;
};

export type DockLiftParams = {
  readonly element: HTMLElement;
  readonly key?: string;
};

export type DockDragSource = {
  readonly onStart: (params: DockDragStart) => void;
  readonly onStartPanel?: (params: DockPanelDragStart) => void;
  readonly onLift?: (params: DockLiftParams) => void;
};

export const DockDragContext = createContext<DockDragSource | null>(null);
