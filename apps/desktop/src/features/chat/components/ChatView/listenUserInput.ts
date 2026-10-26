import { USER_SCROLL_EVENTS } from './useScrollPin';

type Params = {
  readonly root: HTMLElement;
  readonly onInput: () => void;
};

export const listenUserInput = ({ root, onInput }: Params): (() => void) => {
  for (const name of USER_SCROLL_EVENTS) {
    root.addEventListener(name, onInput, { passive: true });
  }
  return () => {
    for (const name of USER_SCROLL_EVENTS) {
      root.removeEventListener(name, onInput);
    }
  };
};
