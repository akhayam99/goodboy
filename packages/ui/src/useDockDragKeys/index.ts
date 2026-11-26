import { useRef } from 'react';
import type { DockDragStore } from '../dockDragStore';
import { dockZoneStepOf, type DockStepDirection } from '../dockZoneStepOf';

type IdParams = {
  readonly id: string;
};

type Params = {
  readonly store: DockDragStore;
  readonly onStep: (params: IdParams) => void;
  readonly onDrop: (params: IdParams) => void;
};

export type DockKeyEvent = {
  readonly key: string;
  readonly preventDefault: () => void;
  readonly stopPropagation: () => void;
};

type KeyEventParams = {
  readonly event: DockKeyEvent;
};

type KeyParams = {
  readonly key: string;
};

export type DockDragKeys = {
  readonly onKeyDown: (params: KeyEventParams) => void;
};

const DIRECTIONS: Readonly<Record<string, DockStepDirection>> = {
  ArrowRight: 'next',
  ArrowDown: 'next',
  ArrowLeft: 'previous',
  ArrowUp: 'previous',
};

const directionOf = ({ key }: KeyParams): DockStepDirection | null => DIRECTIONS[key] ?? null;

export const useDockDragKeys = ({ store, onStep, onDrop }: Params): DockDragKeys => {
  const latest = useRef({ store, onStep, onDrop });
  latest.current = { store, onStep, onDrop };
  const keys = useRef<DockDragKeys>({
    onKeyDown: ({ event }) => {
      const view = latest.current.store.get();
      if (view === null) {
        return;
      }
      if (event.key === 'Enter') {
        if (view.hoverId !== null) {
          event.preventDefault();
          event.stopPropagation();
          latest.current.onDrop({ id: view.hoverId });
        }
        return;
      }
      const direction = directionOf({ key: event.key });
      if (direction === null) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      const id = dockZoneStepOf({ zones: view.zones, hoverId: view.hoverId, direction });
      if (id !== null) {
        latest.current.onStep({ id });
      }
    },
  });
  return keys.current;
};
