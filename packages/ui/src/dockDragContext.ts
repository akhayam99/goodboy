import { createContext, type PointerEvent } from 'react';

export type DockDragStart = {
  readonly event: PointerEvent<HTMLElement>;
};

export type DockDragSource = {
  readonly onStart: (params: DockDragStart) => void;
};

export const DockDragContext = createContext<DockDragSource | null>(null);
