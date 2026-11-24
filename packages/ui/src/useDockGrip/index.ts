import { useContext, type PointerEvent } from 'react';
import { DockDragContext } from '../dockDragContext';

const CONTROL = 'button, a, input, select, textarea, [role="button"], [role="combobox"]';

type PressParams = {
  readonly event: PointerEvent<HTMLElement>;
};

type DockGrip = {
  readonly canDrag: boolean;
  readonly press: (params: PressParams) => void;
};

export const useDockGrip = (): DockGrip => {
  const source = useContext(DockDragContext);
  return {
    canDrag: source !== null,
    press: ({ event }) => {
      const { target } = event;
      if (source === null || !(target instanceof Element)) {
        return;
      }
      if (!event.currentTarget.contains(target) || target.closest(CONTROL) !== null) {
        return;
      }
      source.onStart({ event });
    },
  };
};
