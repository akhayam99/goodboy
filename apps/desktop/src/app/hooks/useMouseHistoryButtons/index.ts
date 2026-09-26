import { useEffect } from 'react';

const MOUSE_BACK = 3;
const MOUSE_FORWARD = 4;

type Params = {
  readonly back: () => void;
  readonly forward: () => void;
};

export const useMouseHistoryButtons = ({ back, forward }: Params): void => {
  useEffect(() => {
    const onMouseUp = (event: MouseEvent) => {
      if (event.button !== MOUSE_BACK && event.button !== MOUSE_FORWARD) {
        return;
      }
      event.preventDefault();
      if (event.button === MOUSE_BACK) {
        back();
        return;
      }
      forward();
    };
    window.addEventListener('mouseup', onMouseUp);
    return () => window.removeEventListener('mouseup', onMouseUp);
  }, [back, forward]);
};
