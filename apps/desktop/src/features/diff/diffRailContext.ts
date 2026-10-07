import { createContext } from 'react';
import type { TreeRailMode } from './treeRailMode';

export type DiffRailSlot = {
  readonly host: HTMLElement | null;
  readonly mode: TreeRailMode;
  readonly width: number;
  readonly paneWidth: () => number;
  readonly resizeTo: (width: number) => void;
};

const noop = (): void => undefined;

export const DiffRailContext = createContext<DiffRailSlot>({
  host: null,
  mode: 'docked',
  width: 0,
  paneWidth: () => Number.POSITIVE_INFINITY,
  resizeTo: noop,
});
