import { RELEASE_FOLLOW_EVENT, USER_SCROLL_EVENTS } from './useScrollPin';

type PointerDownParams = {
  readonly target: EventTarget | null;
};

type Params = {
  readonly root: HTMLElement;
  readonly onInput: () => void;
  readonly onPointerDown: (params: PointerDownParams) => void;
  readonly onRelease: () => void;
};

export const listenUserInput = ({
  root,
  onInput,
  onPointerDown,
  onRelease,
}: Params): (() => void) => {
  const handlePointerDown = ({ target }: PointerEvent) => onPointerDown({ target });
  for (const name of USER_SCROLL_EVENTS) {
    root.addEventListener(name, onInput, { passive: true });
  }
  root.addEventListener('pointerdown', handlePointerDown, { passive: true });
  root.addEventListener(RELEASE_FOLLOW_EVENT, onRelease);
  return () => {
    for (const name of USER_SCROLL_EVENTS) {
      root.removeEventListener(name, onInput);
    }
    root.removeEventListener('pointerdown', handlePointerDown);
    root.removeEventListener(RELEASE_FOLLOW_EVENT, onRelease);
  };
};
