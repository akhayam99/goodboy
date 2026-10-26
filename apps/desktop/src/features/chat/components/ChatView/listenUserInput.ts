import { USER_SCROLL_EVENTS } from './useScrollPin';

type PointerDownParams = {
  readonly target: EventTarget | null;
};

type Params = {
  readonly root: HTMLElement;
  readonly onInput: () => void;
  readonly onPointerDown: (params: PointerDownParams) => void;
};

export const listenUserInput = ({ root, onInput, onPointerDown }: Params): (() => void) => {
  const handlePointerDown = ({ target }: PointerEvent) => onPointerDown({ target });
  for (const name of USER_SCROLL_EVENTS) {
    root.addEventListener(name, onInput, { passive: true });
  }
  root.addEventListener('pointerdown', handlePointerDown, { passive: true });
  return () => {
    for (const name of USER_SCROLL_EVENTS) {
      root.removeEventListener(name, onInput);
    }
    root.removeEventListener('pointerdown', handlePointerDown);
  };
};
