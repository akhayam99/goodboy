import { useEffect, useState } from 'react';
import { TOAST_GUTTER_PX, toastRightOf, type ToastDrawerMode } from '../toastRightOf';

const DRAWER_CARD = '[data-drawer-card]';

const modeOf = (card: HTMLElement): ToastDrawerMode => {
  const mode = card.closest<HTMLElement>('[data-drawer-mode]')?.dataset['drawerMode'];
  return mode === 'push' || mode === 'overlay' ? mode : 'closed';
};

const measureRight = (): number => {
  const card = document.querySelector<HTMLElement>(DRAWER_CARD);
  if (card === null) {
    return TOAST_GUTTER_PX;
  }
  return toastRightOf({
    mode: modeOf(card),
    drawerWidth: window.innerWidth - card.getBoundingClientRect().left,
  });
};

type Params = {
  readonly isActive: boolean;
};

export const useToastRight = ({ isActive }: Params): number => {
  const [right, setRight] = useState(TOAST_GUTTER_PX);

  useEffect(() => {
    if (!isActive) {
      setRight(TOAST_GUTTER_PX);
      return;
    }
    let frame = 0;
    let resizeObserver: ResizeObserver | null = null;
    let observed: Element | null = null;
    const measure = (): void => {
      frame = 0;
      setRight(measureRight());
      const card = document.querySelector(DRAWER_CARD);
      if (card === observed) {
        return;
      }
      resizeObserver?.disconnect();
      observed = card;
      if (card !== null) {
        resizeObserver?.observe(card);
      }
    };
    const schedule = (): void => {
      if (frame !== 0) {
        return;
      }
      frame = requestAnimationFrame(measure);
    };
    resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule);
    const mutations = new MutationObserver(schedule);
    mutations.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-drawer-mode'],
    });
    window.addEventListener('resize', schedule);
    measure();
    return () => {
      if (frame !== 0) {
        cancelAnimationFrame(frame);
      }
      resizeObserver?.disconnect();
      mutations.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [isActive]);

  return right;
};
