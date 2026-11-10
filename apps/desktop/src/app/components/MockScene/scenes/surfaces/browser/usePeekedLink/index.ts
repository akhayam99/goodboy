import { useEffect } from 'react';

type Params = {
  readonly isOn: boolean;
};

const PEEKED_LINK = '[data-browser-session] a[href^="http://localhost"]';

export const usePeekedLink = ({ isOn }: Params): void => {
  useEffect(() => {
    if (!isOn) {
      return;
    }
    let frame = 0;
    const look = () => {
      const link = document.querySelector<HTMLAnchorElement>(PEEKED_LINK);
      if (link === null) {
        frame = window.requestAnimationFrame(look);
        return;
      }
      link.focus({ preventScroll: true });
    };
    frame = window.requestAnimationFrame(look);
    return () => window.cancelAnimationFrame(frame);
  }, [isOn]);
};
