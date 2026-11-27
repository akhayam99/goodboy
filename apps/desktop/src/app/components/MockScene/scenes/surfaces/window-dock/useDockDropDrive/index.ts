import { useEffect } from 'react';

export type DockDropAim = 'merge' | 'below' | 'dock-right';

type Params = {
  readonly aim: DockDropAim;
};

type PointParams = {
  readonly type: 'pointerdown' | 'pointermove';
  readonly x: number;
  readonly y: number;
  readonly target: EventTarget;
};

type CentreParams = {
  readonly element: Element;
};

const SOURCE = '[data-dock-pane="terminal"] [data-dock-drag-source]';
const GIVE_UP_MS = 4000;
const STEP_PX = 24;

const centreOf = ({ element }: CentreParams): { readonly x: number; readonly y: number } => {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
};

const fire = ({ type, x, y, target }: PointParams): void => {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      clientX: x,
      clientY: y,
      button: 0,
      buttons: 1,
      pointerId: 1,
    }),
  );
};

export const useDockDropDrive = ({ aim }: Params): void => {
  useEffect(() => {
    const startedAt = Date.now();
    let frame = 0;
    let isPressed = false;
    const step = (): void => {
      if (Date.now() - startedAt > GIVE_UP_MS) {
        return;
      }
      const source = document.querySelector(SOURCE);
      if (source === null) {
        frame = requestAnimationFrame(step);
        return;
      }
      const from = centreOf({ element: source });
      if (!isPressed) {
        isPressed = true;
        fire({ type: 'pointerdown', x: from.x, y: from.y, target: source });
        fire({ type: 'pointermove', x: from.x + STEP_PX, y: from.y + STEP_PX, target: window });
        frame = requestAnimationFrame(step);
        return;
      }
      const pill = document.querySelector(`[data-dock-zone^="${aim}"] > div`);
      if (pill === null) {
        frame = requestAnimationFrame(step);
        return;
      }
      const to = centreOf({ element: pill });
      fire({ type: 'pointermove', x: to.x, y: to.y, target: window });
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      window.dispatchEvent(new Event('blur'));
    };
  }, [aim]);
};
